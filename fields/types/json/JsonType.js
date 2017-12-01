var assign = require('object-assign');
var FieldType = require('../Type');
var TextType = require('../text/TextType');
var util = require('util');
var utils = require('keystone-utils');

/**
 * HTML FieldType Constructor
 * @extends Field
 * @api public
 */
function json (list, path, options) {
	this._nativeType = String;
	this._defaultSize = 'full';
	this.height = options.height || 180;
	this._properties = ['editor', 'height', 'lang'];
	this.codemirror = options.codemirror || {};
	this.editor = assign({ mode: { name: 'javascript', json: true } }, this.codemirror);
	json.super_.call(this, list, path, options);
}
json.properName = 'Json';
util.inherits(json, FieldType);


/**
 * Asynchronously confirms that the provided email is valid
 */
json.prototype.validateInput = function (data, callback) {
	var input = this.getValueFromData(data);
	var result = true;
	if (input) {
		result = utils.isObject(input);
	}
	utils.defer(callback, result);
};

json.prototype.validateRequiredInput = TextType.prototype.validateRequiredInput;

/* Inherit from TextType prototype */
json.prototype.addFilterToQuery = TextType.prototype.addFilterToQuery;

/**
 * Gets the field's data from an Item, as used by the React components
 */
json.prototype.getData = function (item) {
	return JSON.stringify(item.get(this.path));
};

/**
 * Default method to format the field value for display
 * Overridden by some fieldType Classes
 *
 * @api public
 */
json.prototype.format = function (item) {
	var value = item.get(this.path);
	if (value === undefined) return '';
	return JSON.stringify(value);
};

/**
 * Retrieves the value from an object, whether the path is nested or flattened
 *
 * @api public
 */
json.prototype.getValueFromData = function (data, subpath) {
	return JSON.parse(this._path.get(data, subpath));
};


/* Export Field Type */
module.exports = json;
