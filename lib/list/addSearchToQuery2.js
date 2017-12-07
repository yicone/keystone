var assign = require('object-assign');
var utils = require('keystone-utils');
var debug = require('debug')('keystone:core:list:addSearchToQuery');

function trim (i) { return i.trim(); }
function truthy (i) { return i; }

function getNameFilter (field, searchString) {
	var searchWords = searchString.split(' ').map(trim).filter(truthy).map(utils.escapeRegExp);
	var nameSearchRegExp = new RegExp(searchWords.join('|'), 'i');
	var first = {};
	first[field.paths.first] = nameSearchRegExp;
	var last = {};
	last[field.paths.last] = nameSearchRegExp;
	return {
		$or: [first, last],
	};
}

function getStringFilter (path, searchRegExp) {
	return this.keystone.thinky.r.row(path).match(searchRegExp);
	// var filter = {};
	// filter[path] = searchRegExp;
	// return filter;
}

function addSearchToQuery (searchString) {
	searchString = String(searchString || '').trim();
	var prediction = {};
	var searchFilters = [];
	if (!searchString) return prediction;

	if (this.options.searchUsesTextIndex) {
		debug('Using text search index for value: "' + searchString + '"');
		searchFilters.push({
			$text: {
				$search: searchString,
			},
		});

		if (this.autokey) {
			var strictAutokeyFilter = {};
			var autokeyRegExp = new RegExp('^' + utils.escapeRegExp(searchString));
			strictAutokeyFilter[this.autokey.path] = autokeyRegExp;
			searchFilters.push(strictAutokeyFilter);
		}
	} else {
		debug('Using regular expression search for value: "' + searchString + '"');
		// var searchRegExp = new RegExp(utils.escapeRegExp(searchString), 'i');
		var searchRegExp = '(?i)' + utils.escapeRegExp(searchString);
		var self = this;
		searchFilters = this.searchFields.map(function (i) {
			if (i.field && i.field.type === 'name') {
				return getNameFilter.call(self, i.field, searchString);
			} else {
				return getStringFilter.call(self, i.path, searchRegExp);
			}
		}, this);

		if (this.autokey) {
			var autokeyFilter = {};
			autokeyFilter[this.autokey.path] = searchRegExp;
			searchFilters.push(autokeyFilter);
		}
	}

	if (utils.isValidObjectId(searchString)) {
		searchFilters.push({
			_id: searchString,
		});
	}

	if (searchFilters.length > 1) {
		prediction.$or = searchFilters;
	} else if (searchFilters.length) {
		// assign(prediction, searchFilters[0]);
		prediction = searchFilters[0];
	}

	debug('Built search prediction for value: "' + searchString + '"', prediction);
	return prediction;
}

module.exports = addSearchToQuery;
