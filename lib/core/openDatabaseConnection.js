var debug = require('debug')('keystone:core:openDatabaseConnection');
var assert = require('assert');

Function.prototype.clone = function () {
	var that = this;
	var temp = function temporary () { return that.apply(this, arguments); };
	for (var key in this) {
		if (this.hasOwnProperty(key)) {
			temp[key] = this[key];
		}
	}
	return temp;
};

function addQueryMethods (thinky) {
	// 向 thinky Query 添加兼容 mongoogse 的方法
	thinky.Query.prototype.exec = thinky.Query.prototype.run;
	thinky.Query.prototype.find = function (filter, options) {
		if (!filter) filter = {};
		return this.filter(filter, options);
	};
	var _count = thinky.Query.prototype.count.clone();
	assert(_count !== thinky.Query.prototype.count);
	// TODO: 预期能使用原方法名
	thinky.Query.prototype._count = function (cb) {
		thinky.Query.prototype.count.call(this).execute().nodeify(cb);
	};
	thinky.Query.prototype.sort = thinky.Query.prototype.orderBy;
}

function pruneVirtualFields (doc) {
	if (doc._req_user) {
		pruneVirtualFields(doc._req_user);
	}

	if (doc.__methods) {
		delete doc.__methods;
	}

	var virtualFields = doc._getModel().virtualFields;
	var willRemoved = ['_', 'list'];
	// https://stackoverflow.com/a/21811782/251496
	virtualFields.slice(0).forEach(field => {
		var path = field.path[0];
		if (willRemoved.includes(path)) {
			delete doc[path];
			virtualFields.splice(virtualFields.indexOf(field), 1);
		}
	});
}

function addModelMethods (Model) {
	// 向 thinky model 添加兼容 mongoogse 的方法
	Model.findById = function (id, callback) {
		if (callback) {
			Model.get.call(this, id).run().then(function (item) {
				// TODO:
				delete item.list;
				callback(null, item);
			}).catch(function (err) {
				callback(err);
			});
			return;
		}

		return Model.get.call(this, id);
	};
	Model.find = function (filter, options) {
		if (!filter) filter = {};
		return this.filter(filter, options);
	};
	Model.count = function (cb) {
		Model.__proto__.count.call(this).execute().nodeify(cb);
	};

	Model.pre('save', function (next) {
		pruneVirtualFields(this);
		next();
	});
}

module.exports = function openDatabaseConnection (callback) {

	var keystone = this;
	var mongoConnectionOpen = false;

	// support replica sets for mongoose
	if (keystone.get('mongo replica set')) {

		if (keystone.get('logger')) {
			console.log('\nWarning: using the `mongo replica set` option has been deprecated and will be removed in'
				+ ' a future version.\nInstead set the `mongo` connection string with your host details, e.g.'
				+ ' mongodb://username:password@host:port,host:port,host:port/database and set any replica set options'
				+ ' in `mongo options`.\n\nRefer to https://mongodb.github.io/node-mongodb-native/driver-articles/mongoclient.html'
				+ ' for more details on the connection settings.');
		}

		debug('setting up mongo replica set');
		var replicaData = keystone.get('mongo replica set');
		var replica = '';

		var credentials = (replicaData.username && replicaData.password) ? replicaData.username + ':' + replicaData.password + '@' : '';

		replicaData.db.servers.forEach(function (server) {
			replica += 'mongodb://' + credentials + server.host + ':' + server.port + '/' + replicaData.db.name + ',';
		});

		var options = {
			auth: { authSource: replicaData.authSource },
			replset: {
				rs_name: replicaData.db.replicaSetOptions.rs_name,
				readPreference: replicaData.db.replicaSetOptions.readPreference,
			},
		};

		debug('connecting to replica set');
		keystone.mongoose.connect(replica, options);
	} else {
		// debug('connecting to mongo');
		debug('connecting to rethinkdb');
		keystone.initDatabaseConfig();
		// keystone.mongoose.connect(keystone.get('mongo'), keystone.get('mongo options'));
		keystone.thinky = keystone.thinky(keystone.get('thinky_opt'));

		addQueryMethods(keystone.thinky);
	}

	debug('rethinkdb connection opened');

	var Models = [];
	Object.keys(keystone.lists).forEach(function (key) {
		var list = keystone.lists[key];

		// 将 mongoose 的非虚字段定义在 thinky schema 上
		var schema = Object.keys(list.schema.paths)
		.filter(path => !path.startsWith('_'))
		.reduce((schema, curr) => {
			var fieldOptions = list.schema.path(curr).options;
			if (fieldOptions.thinkyRelation) {
				curr = fieldOptions.thinkyRelation.leftKey;
			}
			schema[curr] = fieldOptions.thinkySchema;
			return schema;
		}, {});

		// 将 mongoose schema 中的 virtuals 移植到 thinky schema 上
		schema = Object.keys(list.schema.virtuals).reduce((schema, curr) => {
			// TODO: 重新验证是否需要排除这两个字段
			var virtual = list.schema.virtuals[curr];
			if (virtual.getters.length > 0 && (curr !== 'id' || virtual.getters.length > 1) && curr !== 'fullname') {
				// 将 mongoose schema virtuals 的 get 移植为 thinky schema virtuals 的 default
				schema[curr] = keystone.thinky.type.virtual().default(function () {
					return virtual.getters[virtual.getters.length - 1].call(this);
				});
			}
			return schema;
		}, schema);

		// if (Object.keys(list.mappings).includes('id')) {
		// 	schema['id'] = keystone.thinky.type.virtual().default(function() {
		// 		return this[list.mappings['id']];
		// 	})
		// }

		// list.register 被调用时，数据库连接还没建立，而 thinky.createModel 需要连接已建立
		var Model = keystone.thinky.createModel(list.options.schema.collection, schema, list.options.schema);

		Model.define('get', function (field) {
			return this[field];
		});
		Model.define('set', function (field, value) {
			var self = this;
			if (list.schema.path(field).setters.length) {
				list.schema.path(field).setters.forEach(function (setter) {
					// apply to model
					setter.call(self, value);
					return;
				});
			}
			var virtualType = list.schema.virtualpath(field);
			if (virtualType && virtualType.setters.length) {
				list.schema.virtualpath(field).setters.forEach(function (setter) {
					// apply to model
					setter.call(self, value);
					return;
				});
			}
			this[field] = value;
		});

		addModelMethods(Model);

		Object.keys(list.fields).forEach((fieldName) => {
			const field = list.fields[fieldName];
			if (field.addToModel) {
				field.addToModel(Model);
			}
		});

		list.model = Model;
		// compatible with mongoose model
		list.model.schema = list.schema;

		Models[key] = Model;
	});

	Object.keys(keystone.lists).forEach(function (key) {
		var Model = Models[key];
		var list = keystone.lists[key];
		list.relationshipFields.forEach(function (field) {
			if (field.thinkyRelation) {
				var opt = field.thinkyRelation;
				switch (opt.mode) {
					case 'hasMany':
						Model.hasMany(Models[opt.model], opt.fieldName, opt.leftKey, opt.rightKey);
						break;

					case 'belongsTo':
						Model.belongsTo(Models[opt.model], opt.fieldName, opt.leftKey, opt.rightKey);
						break;

					default:
						throw new Error('未实现');
				}
			}
		});
	});

	var connected = function () {
		if (keystone.get('auto update')) {
			debug('applying auto update');
			keystone.applyUpdates(callback);
		} else {
			callback();
		}
	};

	if (keystone.sessionStorePromise) {
		keystone.sessionStorePromise.then(connected);
	} else {
		connected();
	}

	keystone.mongoose.connection.on('error', function (err) {

		// The DB connection has been established previously and this a ValidationError caused by restrictions Mongoose is enforcing on the field value
		// We can ignore these here; they'll also be picked up by the 'error' event listener on the model; see /lib/list/register.js
		if (mongoConnectionOpen && err && err.name === 'ValidationError') return;

		// Alternatively, the error is legitimate; output it
		console.error('------------------------------------------------');
		console.error('Mongoose connection "error" event fired with:');
		console.error(err);

		// There's been an error establishing the initial connection, ie. Keystone is attempting to start
		if (!mongoConnectionOpen) {
			throw new Error('KeystoneJS (' + keystone.get('name') + ') failed to start - Check that you are running `mongod` in a separate process.');
		}

		// Otherwise rethrow the initial error
		throw err;

	}).once('open', function () {

		debug('mongo connection open');
		mongoConnectionOpen = true;

		var connected = function () {
			if (keystone.get('auto update')) {
				debug('applying auto update');
				keystone.applyUpdates(callback);
			} else {
				callback();
			}
		};

		if (keystone.sessionStorePromise) {
			keystone.sessionStorePromise.then(connected);
		} else {
			connected();
		}

	});

	return this;
};
