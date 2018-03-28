const mongoose = require('mongoose');
const Store = mongoose.model('Store');
const multer = require('multer');
const jimp = require('jimp');
const uuid = require('uuid');

const multerOptions = {
	storage: multer.memoryStorage(),
	fileFilter(req, file, next) {
		const isPhoto = file.mimetype.startsWith('image/');
		if (isPhoto) {
			next(null, true);
		} else {
			next({ message: 'That file type isn\'t allowed' }, false);
		}
	}
};

exports.homePage = (req, res) => {

	res.render('index');
};

exports.addStore = (req, res) => {
	res.render('editStore', {
		title: 'Add Store'
	});
};

exports.upload = multer(multerOptions).single('photo');

exports.resize = async (req, res, next) => {
	// If there is no new file to resize
	if (!req.file) {
		return next();
	}

	const extension = req.file.mimetype.split('/')[1];

	req.body.photo = `${uuid.v4()}.${extension}`;

	// Now we resize
	const photo = await jimp.read(req.file.buffer);
	// resize(H, W)
	await photo.resize(800, jimp.AUTO);
	await photo.write(`./public/uploads/${req.body.photo}`);

	// Once we have written the photo to our file system, keep going!
	next();
}

exports.createStore = async (req, res) => {
	const store = await (new Store(req.body)).save();

	req.flash('success', `Successfully Created ${store.name}. Care to leave a review?`);

	res.redirect(`/store/${store.slug}`);
};

exports.getStores = async (req, res) => {
	// 1. Query all stores
	const stores = await Store.find();

	res.render('stores', {
		title: 'Stores',
		stores
	});
}

exports.editStore = async (req, res) => {
	// Find the store given the ID
	const store = await Store.findOne({ _id: req.params.id });

	// TODO: Confirm that they are the owner of the store

	// Render out the edit for so the user can edit
	res.render('editStore', {
		title: `Edit ${store.name}`,
		store
	});
}

exports.updateStore = async (req, res) => {
	// Set location data to be a point
	req.body.location.type = 'Point';

	// Find and update store
	const store = await Store.findOneAndUpdate({ _id: req.params.id },
		req.body, {
		new: true, // Returns the new store instead of old one (findOneAndUpdate returns old store by default, force it to new)
		runValidators: true
	}).exec();

	// Alert that it was successfully updated
	req.flash('success', `Successfully updated <strong>${store.name}</strong>. <a href="store/${store.slug}">View Store</a>`);

	// Redirect to store page and tell them it worked
	res.redirect(`/stores/${store._id}/edit`);
}