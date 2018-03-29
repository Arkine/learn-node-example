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

	req.body.author = req.user._id;

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

const confirmOwner = (store, user) => {
	if (!store.author.equals(user._id)) {
		throw Error('You must own a store in order to edit it!');
	}
};
exports.editStore = async (req, res) => {
	// Find the store given the ID
	const store = await Store.findOne({ _id: req.params.id });

	// TODO: Confirm that they are the owner of the store
	confirmOwner(store, req.user);

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

exports.getStoreBySlug = async (req, res, next) => {
	const store = await Store.findOne({ slug: req.params.slug }).populate('author');

	if (!store) {
		return next();
	}

	res.render('store', {
		title: store.name,
		store
	})
}

exports.getStoresByTag = async (req, res) => {
	const tag= req.params.tag;
	const tagQuery = tag || { $exists: true };

	const tagsPromise = Store.getTagsList();
	const storesPromise = Store.find({ tags: tagQuery });

	const [ tags, stores ] = await Promise.all([tagsPromise, storesPromise]);

	res.render('tag', {
		title: 'Tags',
		tag,
		stores,
		tags
	});
};

exports.searchStores = async (req, res) => {
	const stores = await Store.find({
		$text: {
			$search: req.query.q
		}
	}, {
		score: { $meta: 'textScore' }
	})
	.sort({
		score: { $meta: 'textScore' }
	})
	.limit(5);

	res.json(stores);
};

exports.mapStores = async (req, res) => {
	const coordinates = [req.query.lng, req.query.lat].map(parseFloat);
	const q = {
		location: {
			$near: {
				$geometry: {
					type: 'Point',
					coordinates
				},
				$maxDistance: 10000 // 10km
			}
		}
	};
	// Grab the fields we want. Prefix with - to remove unwanted fields
	const stores = await Store.find(q).select('slug name description location photo').limit(10);

	res.json(stores);
};

exports.mapPage = (req, res) => {
	res.render('map', {
		title: 'Map'
	});
}