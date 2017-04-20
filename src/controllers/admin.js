const User = require('../models/User');

exports.getAdmin = (req, res) => {
	if (String(req.user._id) !== process.env.ADMIN)
		return res.send('No permission');

	User.find({}, (err, allUsers) => {
		if (err) console.log(err);

		res.render('admin', {
			title: 'Admin Control Panel',
			allUsers
		});
	});
};

exports.postAdmin = (req, res) => {
	if (String(req.user._id) !== process.env.ADMIN)
		return;

	User.findByIdAndRemove({_id: req.body.id}, (err, deletedUser) => {
		if (err) console.log(err);

		res.redirect('/admin');
	});
};
