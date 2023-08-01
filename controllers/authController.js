const { promisify } = require('util');

const jwt = require('jsonwebtoken');

const User = require('../models/userModel');
const catchAsync = require('./../utils/catchAsync');
const AppError = require('./../utils/appError');
const sendEmail = require('./../utils/email');

const signToken = id => {
  return jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPRESS_IN
  });
};

exports.signup = catchAsync(async (req, res, next) => {
  const newUser = User.create({
    name: req.body.name,
    email: req.body.email,
    password: req.body.password,
    passwordConfirm: req.body.passwordConfirm
  });
  const token = signToken(newUser._id);

  res.status(200).json({
    status: 'success',
    token,
    data: {
      user: newUser
    }
  });
});

exports.login = catchAsync(async (req, res, next) => {
  const { email, password } = req.body;

  //1) checkmif email and password exist
  if (!email || !password) {
    return next(new AppError('Please provide email and Password'));
  }

  //2) check if user esists and passwrod is correct;
  const user = await User.findOne({ email }).select('+password');

  if (!user || !(await user.correctPassword(password, user.password))) {
    return next(new AppError('Incorrect Email or Password', 401));
  }

  //3) if everything is actually fine, lets send token to client
  const token = signToken(user._id);
  res.status(200).json({
    status: 'success',
    token
  });
});

exports.protect = catchAsync(async (req, res, next) => {
  // 1) Getting token and check if it's there
  let token;
  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith('Bearer')
  ) {
    token = req.headers.authorization.split(' ')[1];
  }

  if (!token) {
    return next(
      new AppError('You are not logged in! please log in to get access.', 401)
    );
  }

  //2) verification token

  const decoded = await promisify(jwt.verify)(token, process.env.JWT_SECRET);

  // 3) check if user still exists
  const freshUSer = await User.findById(decoded.id);
  if (!freshUSer) {
    return next(
      new AppError('The user belonging to the token no longer exist', 401)
    );
  }

  //4) check if user change password after the token was issued
  if (freshUSer.changesPasswordAfter(decoded.iat)) {
    return next(
      new AppError('User recently changed password! please log in again', 401)
    );
  }

  //Grant access to the protective route
  req.user = freshUSer;
  next();
});

exports.restrictTo = (...roles) => {
  return (req, res, next) => {
    // roles is an array
    if (!roles.includes(req.user.role)) {
      return next('you do not have permission to perform this action', 403);
    }
  };
};

exports.forgotPassword = catchAsync(async (req, res, next) => {
  //1) Get user based on poted email
  const user = await User.findOne({ eamil: req.body.email });

  if (!user) {
    return next(new AppError('There is no user with email address.', 404));
  }

  //2))generate a random token for them
  const resetToken = user.createPasswordResetToken();

  await user.save({ validateBeforeSave: false });

  //3) sen it back to user's email
  const resetURL = `${req.protocol}://${req.get(
    'host'
  )}/api/v1/users/resetPAssword/${resetToken}}`;

  const message = `Forgot your password Submit a PATCH request with your new password and passwordConfirm to: ${resetURL}. \n If you didn't forget your password, Please ignore this email`;

  try {
    await sendEmail({
      email: user.email,
      subject: 'Your password reset token (valid for 10min',
      message
    });

    res.status(200).json({
      status: 'success',
      message: 'Token sent to email!'
    });
  } catch (err) {
    user.passwordResetToken = undefined;
    user.passwordResetExpires = undefined;
    await user.save({ validateBeforeSave: false });

    return next(
      new AppError('There was an error sending the email. Try again later')
    );
  }
});

exports.resetPassword = (req, res, next) => {};
