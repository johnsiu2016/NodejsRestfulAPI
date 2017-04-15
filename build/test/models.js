'use strict';

var mongoose = require('mongoose');

var _require = require('chai'),
    expect = _require.expect;

var sinon = require('sinon');
require('sinon-mongoose');

var User = require('../models/User');

describe('User Model', function () {
  it('should create a new user', function (done) {
    var UserMock = sinon.mock(new User({ email: 'test@gmail.com', password: 'root' }));
    var user = UserMock.object;

    UserMock.expects('save').yields(null);

    user.save(function (err, result) {
      UserMock.verify();
      UserMock.restore();
      expect(err).to.be.null;
      done();
    });
  });

  it('should return error if user is not created', function (done) {
    var UserMock = sinon.mock(new User({ email: 'test@gmail.com', password: 'root' }));
    var user = UserMock.object;
    var expectedError = {
      name: 'ValidationError'
    };

    UserMock.expects('save').yields(expectedError);

    user.save(function (err, result) {
      UserMock.verify();
      UserMock.restore();
      expect(err.name).to.equal('ValidationError');
      expect(result).to.be.undefined;
      done();
    });
  });

  it('should not create a user with the unique email', function (done) {
    var UserMock = sinon.mock(User({ email: 'test@gmail.com', password: 'root' }));
    var user = UserMock.object;
    var expectedError = {
      name: 'MongoError',
      code: 11000
    };

    UserMock.expects('save').yields(expectedError);

    user.save(function (err, result) {
      UserMock.verify();
      UserMock.restore();
      expect(err.name).to.equal('MongoError');
      expect(err.code).to.equal(11000);
      expect(result).to.be.undefined;
      done();
    });
  });

  it('should find user by email', function (done) {
    var userMock = sinon.mock(User);
    var expectedUser = {
      _id: '5700a128bd97c1341d8fb365',
      email: 'test@gmail.com'
    };

    userMock.expects('findOne').withArgs({ email: 'test@gmail.com' }).yields(null, expectedUser);

    User.findOne({ email: 'test@gmail.com' }, function (err, result) {
      userMock.verify();
      userMock.restore();
      expect(result.email).to.equal('test@gmail.com');
      done();
    });
  });

  it('should remove user by email', function (done) {
    var userMock = sinon.mock(User);
    var expectedResult = {
      nRemoved: 1
    };

    userMock.expects('remove').withArgs({ email: 'test@gmail.com' }).yields(null, expectedResult);

    User.remove({ email: 'test@gmail.com' }, function (err, result) {
      userMock.verify();
      userMock.restore();
      expect(err).to.be.null;
      expect(result.nRemoved).to.equal(1);
      done();
    });
  });
});