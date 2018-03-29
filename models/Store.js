const mongoose = require('mongoose');
mongoose.Promise = global.Promise;
const slug = require('slugs');

const storeSchema = new mongoose.Schema({
	name: {
		type: String,
		trim: true,
		required: 'Please enter a store name!'
	},
	slug: String,
	description: {
		type: String,
		trim: true
	},
	tags: [String],
	created: {
		type: Date,
		default: Date.now
	},
	location: {
		type: {
			type: String,
			default: 'Point'
		},
		coordinates: [{
			type: Number,
			required: 'You must supply coordinates!'
		}],
		address: {
			type: String,
			required: 'You must supply an address!'
		}
	},
	photo: String,
	author: {
		type: mongoose.Schema.ObjectId,
		ref: 'User',
		required: 'You must supply an author!'
	}
},
{
	toJSON: { virtuals: true },
	toObject: { virtuals: true }
});

// Define our indexes
storeSchema.index({
	name: 'text',
	description: 'text'
});

storeSchema.index({
	location: '2dsphere'
});

storeSchema.pre('save', async function(next) {
	if (!this.isModified('name')) {
		return next(); // Skip it
	}

	// Turn the store name into a slug
	this.slug = slug(this.name);

	// Find others stores that have a similar slug for same name stores to create unique slugs
	const slugRegEx = new RegExp(`^(${this.slug})((-[0-9]*$)?)$`, 'i');
	const storesWithSlug = await this.constructor.find({ slug: slugRegEx }); // this.constructor will return store at runtime

	if (storesWithSlug.length) {
		this.slug = `${this.slug}-${storesWithSlug.length + 1}`;
	}

	next();
});

// Gets list of all tags
storeSchema.statics.getTagsList = function() {
	return this.aggregate([
		{ $unwind: '$tags' },
		{ $group: { _id: '$tags', count: { $sum: 1 } } },
		{ $sort: { count: -1 } }
	]);
};

// Gets top stores
storeSchema.statics.getTopStores = function() {
	return this.aggregate([
		// Lookup stores and populate reviews
		{
			$lookup: {
				from: 'reviews',
				localField: '_id',
				foreignField: 'store',
				as: 'reviews'
			}
		},
		// Filter for stores w/ 2 or more reviews
		{
			$match: {
				'reviews.1': {
					$exists: true
				}
			}
		},
		// Add the average reviews field
		{
			$addFields: {
				averageRating: {
					$avg: '$reviews.rating'
				}
			}
		},
		// Sort it by new field, highest reviews first
		{
			$sort: {
				averageRating: -1
			}
		},
		// limit to 10
		{
			$limit: 10
		}
	]);
}

// Find reviews where the store's _id property === review's store property
storeSchema.virtual('reviews', {
	ref: 'Review', // what model to link
	localField: '_id', // Which field on the store
	foreignField: 'store' // Which field on the review
});

function autoPopulate(next) {
	this.populate('reviews');
	next();
}

storeSchema.pre('find', autoPopulate);
storeSchema.pre('findOne', autoPopulate);

module.exports = mongoose.model('Store', storeSchema);