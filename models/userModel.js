const crypto = require('crypto');
const mongoose = require('mongoose');
const validator = require('validator');

const bcrypt = require('bcryptjs');

const UserSchema = mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Please tell us your name']
  },
  email: {
    type: String,
    required: [true, 'Please provide ypur email'],
    unique: true,
    lowerCase: true,
    validate: [validator.isEmail, 'Please provide a valid email']
  },

  photo: String,
  role: {
    type: String,
    enum: ['user', 'guide', 'lead-guide', 'admin'],
    default: 'user'
  },

  password: {
    type: String,
    required: [true, 'Please provide a password'],
    minLength: 8,
    select: false
  },

  passwordConfirm: {
    type: String,
    required: [true, 'Please confirm your password'],
    validate: {
      //This only works on create and save
      validator: function(el) {
        return el === this.password;
      },
      message: 'Passwords are not the same'
    }
  },
  passwordChangedAt: Date,
  passwordResetToken: String,
  passwordResetExpires: Date
});

UserSchema.pre('save', async function(next) {
  // eslint-disable-next-line no-useless-return
  //omly run function if password is actually modified.
  if (!this.isModified('password')) return;

  //hash the password with cost of 14
  this.password = await bcrypt.hash(this.password, 14);

  //delete passwordConfirm field.
  this.passwordConfirm = undefined;
  next();
});

//instance method available on all user documents
UserSchema.methods.correctPassword = async function(
  candidatePassword,
  userPassword
) {
  return await bcrypt.compare(candidatePassword, userPassword);
};

UserSchema.methods.changesPasswordAfter = function(JWTTimestamp) {
  if (this.passwordChangedAt) {
    const changedTimestamp = parseInt(
      this.passwordChangedAt.getTime() / 1000,
      10
    );
    return JWTTimestamp < changedTimestamp;
  }

  // false means not changed
  return false;
};

UserSchema.methods.createPasswordResetToken = function() {
  const resetToken = crypto.randomBytes(32).toString('hex');

  this.passwordResetToken = crypto
    .createHash('sha256')
    .update(resetToken)
    .digest('hex');

  this.passwordResetExpires = Date.now() + 10 * 60 * 1000;

  return resetToken;
};

const User = mongoose.model('User', UserSchema);

module.exports = User;
