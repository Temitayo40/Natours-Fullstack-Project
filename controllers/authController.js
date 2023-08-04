const crypto = require('crypto');
const { promisify } = require('util');
const jwt = require('jsonwebtoken');
const User = require('../models/userModel');
const catchAsync = require('./../utils/catchAsync');
const AppError = require('./../utils/appError');
const sendEmail = require('./../utils/email');

// SIGNUP Token
const signToken = id => {
  return jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPRESS_IN
  });
};

// CREATE AND SEND TOKEN.
const createSendToken = (user, statusCode, res) => {
  const token = signToken(user._id);

  const cookieOptions = {
    expires: new Date(
      Date.now() + process.env.JWT_COOKIE_EXPIRES_IN * 24 * 60 * 60 * 1000
    ),
    httpOnly: true
  };

  if (process.env.NODE_ENV === 'production') cookieOptions.secure = true;

  res.cookie('jwt', token, cookieOptions);

  user.password = undefined;
  res.status(statusCode).json({
    status: 'success',
    token,
    data: {
      user
    }
  });
};

//SignUP USER with EMAIL and PASSWORD, and confirm the password.

exports.signup = catchAsync(async (req, res, next) => {
  const newUser = User.create({
    name: req.body.name,
    email: req.body.email,
    password: req.body.password,
    passwordConfirm: req.body.passwordConfirm
  });
  createSendToken(newUser, 201, res);
});

// LOGIN  user with EMAIL and PASSWORD.

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
  createSendToken(user, 200, res);
});

//PROTECT the

exports.protect = catchAsync(async (req, res, next) => {
  // Getting token and check if its there
  let token;
  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith('Bearer')
  ) {
    token = req.headers.authorization.split(' ')[1];
  }

  if (!token) {
    next(
      new AppError('You are not logged in! please log in  to get access', 401)
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
  const user = await User.findOne({ email: req.body.email });

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
      subject: 'Your password reset token (valid for 10min)',
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

exports.resetPassword = catchAsync(async (req, res, next) => {
  // 1) Get user based on the token
  const hashedToken = crypto
    .createHash('sha256')
    .update(req.params.token)
    .digest('hex');

  const user = await User.findOne({
    passwordResetToken: hashedToken,
    passwordResetExpires: { $gt: Date.now() }
  });

  //2)I f token has not expired, and there is user, set the new password.
  if (!user) {
    return next(new AppError('Token is invalid or has expired'));
  }

  user.password = req.body.password;
  user.passwordConfirm = req.body.passwordConfirm;
  user.passwordResetToken = undefined;
  user.passwordResetExpires = undefined;

  await user.save(); //

  //3)Update changedPassword property for the
  //4)Update the user in, send jwt
  createSendToken(user, 200, res);
});

exports.updatePassword = catchAsync(async (req, res, next) => {
  //1)Get the ueser from the collection
  const user = await User.findById(req.user.id).select('+password');
  //2) Check if the posted password is correct
  if (!user.correctPassword(req.body.passwordCurrent, user.password)) {
    return next(new AppError('Your new password is wrong'));
  }
  //3) If so, update the password
  user.password = req.body.password;
  user.passwordConfirm = req.body.passwordConfirm;
  await user.save();
  //4) log user in send. jwt
  createSendToken(user, 200, res);
});
