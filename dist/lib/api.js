/**
 *  All public interfaces are contained here.  They either fan out to query.js, update.js or db.js in the
 *  individual database directories.  Three kinds of interfaces are available
 *
 *  - Object Intefaces are methods added to objects instantiated from PersistObjectTemplate contexts
 *
 *  - Template interfaces are methods added to templates instantiated from PersistObjectTemplate
 *
 *  - ObjectTemplate intefaces are session level interfaces
 *
 */
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g;
    return g = { next: verb(0), "throw": verb(1), "return": verb(2) }, typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (_) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
module.exports = function (PersistObjectTemplate, baseClassForPersist) {
    var statsdUtils = require('supertype').StatsDHelper;
    var SupertypeSession = require('supertype').SupertypeSession;
    var Promise = require('bluebird');
    var _ = require('underscore');
    function getTime() {
        return process.hrtime();
    }
    function getStats(startTime, templateName, queryType, error) {
        return statsdUtils.computeTimingAndSend(startTime, SupertypeSession.statsDClient, 'amorphic.session.get_session_cache.response_time', {
            _persistorError: error,
            _templateName: templateName,
            _queryType: queryType
        });
    }
    /**
     * PUBLIC INTERFACE FOR OBJECTS
     */
    PersistObjectTemplate.getPersistorProps = function () {
        var persistorProps = {};
        _.each(PersistObjectTemplate.__dictionary__, processTemplate);
        return persistorProps;
        function processTemplate(template) {
            var props = template.getProperties();
            _.each(props, processDefineProperty);
            function processDefineProperty(_defineProperty, prop) {
                if (prop.match(/Persistor$/) && prop.substr(0, 2) != '__') {
                    persistorProps[template.__name__] = persistorProps[template.__name__] || {};
                    persistorProps[template.__name__][prop.replace(/Persistor$/, '')] = 1;
                }
            }
        }
    };
    /**
     * PUBLIC INTERFACE FOR TEMPLATES
     *
     * @param {supertype} template - load all parent/child/subdocument/subsetof defitions
     */
    PersistObjectTemplate._injectIntoTemplate = function (template) {
        this._prepareSchema(template);
        this._injectTemplateFunctions(template);
        this._injectObjectFunctions(template);
    };
    PersistObjectTemplate._prepareSchema = function (template) {
        if (!this.schemaVerified) {
            this._verifySchema();
        }
        this.schemaVerified = true;
        // Process subclasses that didn't have schema entries
        var parent = template.__parent__;
        while (!template.__schema__ && parent) {
            if (parent.__schema__) {
                template.__schema__ = parent.__schema__;
                template.__collection__ = parent.__collection__;
                template.__table__ = template.__schema__.table ? template.__schema__.table : parent.__table__;
                template.__topTemplate = parent.__topTemplate__;
                parent = null;
            }
            else {
                parent = parent.__parent__;
            }
        }
        // Process subsets
        if (template.__schema__ && template.__schema__.subsetOf) {
            var mainTemplate = this.__dictionary__[template.__schema__.subsetOf];
            if (!mainTemplate) {
                throw new Error('Reference to subsetOf ' + template.__schema__.subsetOf + ' not found for ' + template.__name__);
            }
            template.__subsetOf__ = template.__schema__.subsetOf;
            if (!mainTemplate.__schema__) {
                parent = mainTemplate.__parent__;
                while (!mainTemplate.__schema__ && parent) {
                    if (parent.__schema__) {
                        mainTemplate.__schema__ = parent.__schema__;
                        mainTemplate.__collection__ = parent.__collection__;
                        mainTemplate.__table__ = mainTemplate.__schema__.table ? mainTemplate.__schema__.table : parent.__table__;
                        mainTemplate.__topTemplate = parent.__topTemplate__;
                        parent = null;
                    }
                    else {
                        parent = parent.__parent__;
                    }
                }
                if (!mainTemplate.__schema__) {
                    throw new Error('Missing schema entry for ' + template.__schema__.subsetOf);
                }
            }
            mergeRelationships(template.__schema__, mainTemplate.__schema__);
            template.__collection__ = mainTemplate.__collection__;
            template.__table__ = mainTemplate.__table__;
        }
        baseClassForPersist._injectIntoTemplate(template);
        function mergeRelationships(orig, overlay) {
            _.each(overlay.children, function (value, key) {
                orig.children = orig.children || {};
                if (!orig.children[key]) {
                    orig.children[key] = value;
                }
            });
            _.each(overlay.parents, function (value, key) {
                orig.parents = orig.parents || {};
                if (!orig.parents[key]) {
                    orig.parents[key] = value;
                }
            });
        }
    };
    PersistObjectTemplate._injectTemplateFunctions = function (template) {
        function logExceptionAndRethrow(exception, logger, template, query, activity) {
            if (typeof (query) === 'undefined') {
                query = 'undefined value provided';
            }
            else if (typeof (query) === 'object') {
                var undefHandler = function (key, value) { return typeof (value) === 'undefined' ? 'undefined value provided for ' + key : value; };
                query = JSON.stringify(query, undefHandler);
            }
            logger.error({
                component: 'persistor', module: 'api', activity: activity,
                data: { template: template, query: query }
            });
            throw exception;
        }
        /**
         * Return a single instance of an object of this class given an id
         *
         * @param {string} id mongo style id
         * @param {bool} cascade, loads children if requested
         * @param {bool} isTransient - marking the laoded object as transient.
         * @param {object} idMap id mapper for cached objects
         * @param {bool} isRefresh force load
         * @param {object} logger objecttemplate logger
         * @returns {object}
         */
        template.getFromPersistWithId = function (id, cascade, isTransient, idMap, isRefresh, logger) {
            return __awaiter(this, void 0, void 0, function () {
                var dbType, time, getQuery, name;
                return __generator(this, function (_a) {
                    (logger || PersistObjectTemplate.logger).debug({
                        component: 'persistor', module: 'api', activity: 'getFromPersistWithId',
                        data: { template: template.__name__, id: id }
                    });
                    dbType = PersistObjectTemplate.getDB(PersistObjectTemplate.getDBAlias(template.__collection__)).type;
                    time = getTime();
                    getQuery = (dbType == PersistObjectTemplate.DB_Mongo ?
                        PersistObjectTemplate.getFromPersistWithMongoId(template, id, cascade, isTransient, idMap, logger) :
                        PersistObjectTemplate.getFromPersistWithKnexId(template, id, cascade, isTransient, idMap, isRefresh, logger))
                        .then(function (res) {
                        return res;
                    }.bind(this));
                    name = 'getFromPersistWithId';
                    return [2 /*return*/, getQuery
                            .then(function (result) {
                            getStats(time, template.__name__, name);
                            return result;
                        })
                            .catch(function (e) {
                            getStats(time, template.__name__, name, true);
                            return logExceptionAndRethrow(e, logger || PersistObjectTemplate.logger, template.__name__, id, name);
                        })];
                });
            });
        };
        /**
         * Return an array of objects of this class given a json query
         *
         * @param {json} query mongo style queries
         * @param {bool} cascade, loads children if requested
         * @param {numeric} start - starting position of the result set.
         * @param {numeric} limit - limit the result set
         * @param {bool} isTransient {@TODO}
         * @param {object} idMap id mapper for cached objects
         * @param {bool} options {@TODO}
         * @param {object} logger objecttemplate logger
         * @returns {object}
         * @deprecated in favor of persistorFetchWithQuery
         */
        template.getFromPersistWithQuery = function (query, cascade, start, limit, isTransient, idMap, options, logger) {
            return __awaiter(this, void 0, void 0, function () {
                var dbType, time, getQuery, name;
                return __generator(this, function (_a) {
                    (logger || PersistObjectTemplate.logger).debug({
                        component: 'persistor', module: 'api', activity: 'getFromPersistWithQuery',
                        data: { template: template.__name__ }
                    });
                    dbType = PersistObjectTemplate.getDB(PersistObjectTemplate.getDBAlias(template.__collection__)).type;
                    time = getTime();
                    getQuery = (dbType == PersistObjectTemplate.DB_Mongo ?
                        PersistObjectTemplate.getFromPersistWithMongoQuery(template, query, cascade, start, limit, isTransient, idMap, options, logger) :
                        PersistObjectTemplate.getFromPersistWithKnexQuery(null, template, query, cascade, start, limit, isTransient, idMap, options, undefined, undefined, logger))
                        .then(function (res) {
                        return res;
                    }.bind(this));
                    name = 'getFromPersistWithQuery';
                    return [2 /*return*/, getQuery
                            .then(function (result) {
                            getStats(time, template.__name__, name);
                            return result;
                        })
                            .catch(function (e) {
                            getStats(time, template.__name__, name, true);
                            return logExceptionAndRethrow(e, logger || PersistObjectTemplate.logger, template.__name__, query, name);
                        })];
                });
            });
        };
        /**
         * Delete objects given a json query
         *
         * @param {json} query mongo style queries
         * @param {object} txn persistObjectTemplate transaciton object
         * @param {object} logger objecttemplate logger
         * @returns {object}
         * @deprecated in favor of persitorDeleteByQuery
         */
        template.deleteFromPersistWithQuery = function (query, txn, logger) {
            return __awaiter(this, void 0, void 0, function () {
                var dbType, time, getQuery, name;
                return __generator(this, function (_a) {
                    dbType = PersistObjectTemplate.getDB(PersistObjectTemplate.getDBAlias(template.__collection__)).type;
                    time = getTime();
                    getQuery = dbType == PersistObjectTemplate.DB_Mongo ?
                        PersistObjectTemplate.deleteFromPersistWithMongoQuery(template, query, logger) :
                        PersistObjectTemplate.deleteFromKnexQuery(template, query, txn, logger);
                    name = 'deleteFromQuery';
                    return [2 /*return*/, getQuery
                            .then(function (result) {
                            getStats(time, template.__name__, name);
                            return result;
                        })
                            .catch(function (e) {
                            getStats(time, template.__name__, name, true);
                        })];
                });
            });
        };
        /**
         * Fetch an object by id
         * @param {string} id mongo style id
         * @param {json} options @todo
         * @returns {*}
         */
        template.persistorFetchById = function (id, options) {
            return __awaiter(this, void 0, void 0, function () {
                var time, persistObjectTemplate, dbType, fetchQuery, name;
                return __generator(this, function (_a) {
                    time = getTime();
                    PersistObjectTemplate._validateParams(options, 'fetchSchema', template);
                    options = options || {};
                    persistObjectTemplate = options.session || PersistObjectTemplate;
                    (options.logger || persistObjectTemplate.logger).debug({
                        component: 'persistor', module: 'api', activity: 'persistorFetchById',
                        data: { template: template.__name__, id: id }
                    });
                    dbType = persistObjectTemplate.getDB(persistObjectTemplate.getDBAlias(template.__collection__)).type;
                    fetchQuery = (dbType == persistObjectTemplate.DB_Mongo ?
                        persistObjectTemplate.getFromPersistWithMongoId(template, id, options.fetch, options.transient, null, options.logger) :
                        persistObjectTemplate.getFromPersistWithKnexId(template, id, options.fetch, options.transient, null, null, options.logger, options.enableChangeTracking, options.projection));
                    name = 'persistorFetchById';
                    return [2 /*return*/, fetchQuery
                            .then(function (result) {
                            getStats(time, template.__name__, name);
                            return result;
                        })
                            .catch(function (e) {
                            getStats(time, template.__name__, name, true);
                            return logExceptionAndRethrow(e, options.logger || PersistObjectTemplate.logger, template.__name__, id, name);
                        })];
                });
            });
        };
        /**
         * Delete all objects matching a query
         * @param {JSON} query @TODO
         * @param {JSON} options @TODO
         * @returns {Object}
         */
        template.persistorDeleteByQuery = function (query, options) {
            return __awaiter(this, void 0, void 0, function () {
                var time, dbType, deleteQuery, name;
                return __generator(this, function (_a) {
                    time = getTime();
                    PersistObjectTemplate._validateParams(options, 'persistSchema', template);
                    options = options || {};
                    dbType = PersistObjectTemplate.getDB(PersistObjectTemplate.getDBAlias(template.__collection__)).type;
                    deleteQuery = dbType == PersistObjectTemplate.DB_Mongo ?
                        PersistObjectTemplate.deleteFromPersistWithMongoQuery(template, query, options.logger) :
                        PersistObjectTemplate.deleteFromKnexByQuery(template, query, options.transaction, options.logger);
                    name = 'persistorDeleteByQuery';
                    return [2 /*return*/, deleteQuery
                            .then(function (result) {
                            getStats(time, template.__name__, name);
                            return result;
                        })
                            .catch(function (e) {
                            getStats(time, template.__name__, name, true);
                        })];
                });
            });
        };
        /**
         * Fetch all objects matching a query
         * @param {JSON} query @TODO
         * @param {JSON} options @TODO
         * @returns {*}
         */
        template.persistorFetchByQuery = function (query, options) {
            return __awaiter(this, void 0, void 0, function () {
                var time, persistObjectTemplate, logger, dbType, fetchQuery, name;
                return __generator(this, function (_a) {
                    time = getTime();
                    PersistObjectTemplate._validateParams(options, 'fetchSchema', template);
                    options = options || {};
                    persistObjectTemplate = options.session || PersistObjectTemplate;
                    logger = options.logger || persistObjectTemplate.logger;
                    logger.debug({
                        component: 'persistor', module: 'api', activity: 'persistorFetchByQuery',
                        data: { template: template.__name__ }
                    });
                    dbType = persistObjectTemplate.getDB(persistObjectTemplate.getDBAlias(template.__collection__)).type;
                    if (options.order && !options.order.sort) {
                        options.order = { sort: options.order };
                    }
                    fetchQuery = (dbType == persistObjectTemplate.DB_Mongo ?
                        persistObjectTemplate.getFromPersistWithMongoQuery(template, query, options.fetch, options.start, options.limit, options.transient, options.order, options.order, logger) :
                        persistObjectTemplate.getFromPersistWithKnexQuery(null, template, query, options.fetch, options.start, options.limit, options.transient, null, options.order, undefined, undefined, logger, options.enableChangeTracking, options.projection));
                    name = 'persistorFetchByQuery';
                    return [2 /*return*/, fetchQuery
                            .then(function (result) {
                            getStats(time, template.__name__, name);
                            return result;
                        })
                            .catch(function (e) {
                            getStats(time, template.__name__, name, true);
                            return logExceptionAndRethrow(e, options.logger || PersistObjectTemplate.logger, template.__name__, query, name);
                        })];
                });
            });
        };
        /**
         * Return count of objects of this class given a json query
         *
         * @param {json} query mongo style queries
         * @param {object} options @TODO
         * @returns {Number}
         */
        template.persistorCountByQuery = function (query, options) {
            return __awaiter(this, void 0, void 0, function () {
                var time, logger, dbType, countQuery, name;
                return __generator(this, function (_a) {
                    time = getTime();
                    PersistObjectTemplate._validateParams(options, 'fetchSchema', template);
                    options = options || {};
                    logger = options.logger || PersistObjectTemplate.logger;
                    logger.debug({
                        component: 'persistor', module: 'api', activity: 'persistorCountByQuery',
                        data: { template: template.__name__ }
                    });
                    dbType = PersistObjectTemplate.getDB(PersistObjectTemplate.getDBAlias(template.__collection__)).type;
                    countQuery = (dbType == PersistObjectTemplate.DB_Mongo ?
                        PersistObjectTemplate.countFromMongoQuery(template, query, logger) :
                        PersistObjectTemplate.countFromKnexQuery(template, query, logger))
                        .then(function (res) {
                        return res;
                    }.bind(this));
                    name = 'persistorCountByQuery';
                    return [2 /*return*/, countQuery
                            .then(function (result) {
                            getStats(time, template.__name__, name);
                            return result;
                        })
                            .catch(function (e) {
                            getStats(time, template.__name__, name, true);
                            return logExceptionAndRethrow(e, options.logger || PersistObjectTemplate.logger, template.__name__, query, { activity: 'persistorCountByQuery' });
                        })];
                });
            });
        };
        /**
         * Delete objects given a json query
         *
         * @param {string} id mongo style id
         * @param {object} txn persistObjectTemplate transaciton object
         * @param {object} logger objecttemplate logger
         * @returns {object}
         * @deprecated in favor of persistorDeleteByQuery
         */
        template.deleteFromPersistWithId = function (id, txn, logger) {
            return __awaiter(this, void 0, void 0, function () {
                var time, dbType, deleteQuery, name;
                return __generator(this, function (_a) {
                    time = getTime();
                    (logger || PersistObjectTemplate.logger).debug({
                        component: 'persistor', module: 'api', activity: 'deleteFromPersistWithId',
                        data: { template: template.__name__, id: id }
                    });
                    dbType = PersistObjectTemplate.getDB(PersistObjectTemplate.getDBAlias(template.__collection__)).type;
                    deleteQuery = (dbType == PersistObjectTemplate.DB_Mongo ?
                        PersistObjectTemplate.deleteFromPersistWithMongoId(template, id, logger) :
                        PersistObjectTemplate.deleteFromKnexId(template, id, txn, logger))
                        .then(function (res) {
                        return res;
                    }.bind(this));
                    name = 'deleteFromPersistWithId';
                    return [2 /*return*/, deleteQuery
                            .then(function (result) {
                            getStats(time, template.__name__, name);
                            return result;
                        })
                            .catch(function (e) {
                            getStats(time, template.__name__, name, true);
                            return logExceptionAndRethrow(e, logger || PersistObjectTemplate.logger, template.__name__, id, { activity: 'deleteFromPersistWithId' });
                        })];
                });
            });
        };
        /**
         * Return count of objects of this class given a json query
         *
         * @param {json} query mongo style queries
         * @param {object} logger objecttemplate logger
         * @returns {Number}
         * @deprecated in favor of persistorCountWithQuery
         */
        template.countFromPersistWithQuery = function (query, logger) {
            return __awaiter(this, void 0, void 0, function () {
                var time, dbType, countQuery, name;
                return __generator(this, function (_a) {
                    time = getTime();
                    (logger || PersistObjectTemplate.logger).debug({
                        component: 'persistor', module: 'api', activity: 'countFromPersistWithQuery',
                        data: { template: template.__name__ }
                    });
                    dbType = PersistObjectTemplate.getDB(PersistObjectTemplate.getDBAlias(template.__collection__)).type;
                    countQuery = (dbType == PersistObjectTemplate.DB_Mongo ?
                        PersistObjectTemplate.countFromMongoQuery(template, query, logger) :
                        PersistObjectTemplate.countFromKnexQuery(template, query, logger))
                        .then(function (res) {
                        return res;
                    }.bind(this));
                    name = 'countFromPersistWithQuery';
                    return [2 /*return*/, countQuery
                            .then(function (result) {
                            getStats(time, template.__name__, name);
                            return result;
                        })
                            .catch(function (e) {
                            getStats(time, template.__name__, name, true);
                            return logExceptionAndRethrow(e, logger || PersistObjectTemplate.logger, template.__name__, query, name);
                        })];
                });
            });
        };
        /**
         * Determine whether we are using knex on this table
         * @returns {boolean}
         */
        template.persistorIsKnex = function () {
            var dbType = PersistObjectTemplate.getDB(PersistObjectTemplate.getDBAlias(template.__collection__)).type;
            return dbType != PersistObjectTemplate.DB_Mongo;
        };
        /**
         * Get a knex object that can be used to create native queries (e.g. template.getKnex().select().from())
         * @returns {*}
         */
        template.persistorGetKnex = function () {
            var tableName = PersistObjectTemplate.dealias(template.__table__);
            return PersistObjectTemplate.getDB(PersistObjectTemplate.getDBAlias(template.__table__)).connection(tableName);
        };
        /**
         * Return knex table name for template for use in native queries
         * @param {string} alias - table alias alias named used when setting the DB object
         * @returns {string}
         */
        template.persistorGetTableName = function (alias) {
            return PersistObjectTemplate.dealias(template.__table__) + (alias ? ' as ' + alias : '');
        };
        /**
         * Return the foreign key for a given parent property for use in native queries
         * @param {string} prop field name
         * @param {string} alias - table alias name used for query generation
         * @returns {string}
         */
        template.persistorGetParentKey = function (prop, alias) {
            return (alias ? alias + '.' : '') + template.__schema__.parents[prop].id;
        };
        /**
         * Return the foreign key for a given child property for use in native queries
         * @param {string} prop field name
         * @param {string} alias - table alias name used for query generation
         * @returns {string}
         */
        template.persistorGetChildKey = function (prop, alias) {
            return (alias ? alias + '.' : '') + template.__schema__.children[prop].id;
        };
        /**
         * Return '_id'
         * @param {string} alias - table alias name used for query generation
         * @returns {string}
         */
        template.persistorGetId = function (alias) {
            return (alias ? alias + '.' : '') + '_id';
        };
        /**
         * return an array of join parameters (e.g. .rightOuterJoin.apply(template.getKnex(), Transaction.knexChildJoin(...)))
         * @param {object} targetTemplate objecttemplate
         * @param {string} primaryAlias - table alias name used for query generation
         * @param {string} targetAlias - table alias name used for query generation
         * @param {string} joinKey - field name
         * @returns {*[]}
         */
        template.persistorKnexParentJoin = function (targetTemplate, primaryAlias, targetAlias, joinKey) {
            return [template.getTableName() + ' as ' + primaryAlias, targetTemplate.getParentKey(joinKey, targetAlias), template.getPrimaryKey(primaryAlias)];
        };
        /**
         * return an array of join parameters (e.g. .rightOuterJoin.apply(template.getKnex(), Transaction.knexChildJoin(...)))
         * @param {object} targetTemplate target table to join with
         * @param {object} primaryAlias table alias name for the source/current object
         * @param {object} targetAlias table alias name for the target table.
         * @param {string} joinKey source table field name
         * @returns {*[]}
         */
        template.persistorKnexChildJoin = function (targetTemplate, primaryAlias, targetAlias, joinKey) {
            return [template.getTableName() + ' as ' + primaryAlias, targetTemplate.getChildKey(joinKey, primaryAlias), targetTemplate.getPrimaryKey(targetAlias)];
        };
        // Deprecated API
        template.isKnex = template.persistorIsKnex;
        template.getKnex = template.persistorGetKnex;
        template.getTableName = template.persistorGetTableName;
        template.getParentKey = template.persistorGetParentKey;
        template.getChildKey = template.persistorGetChildKey;
        template.getPrimaryKey = template.persistorGetId;
        template.knexParentJoin = template.persistorKnexParentJoin;
        template.knexChildJoin = template.persistorKnexChildJoin;
        /**
         * Inject the persitor properties and get/fetch methods need for persistence.  This is either called
         * as part of _injectTemplate if the template was fully created or when the template is instantiated lazily
         * @private
         */
        template._injectProperties = function () {
            if (this.hasOwnProperty('__propertiesInjected__'))
                return;
            var props = this.defineProperties;
            for (var prop in props) {
                var defineProperty = props[prop];
                var type = defineProperty.type;
                var of = defineProperty.of;
                var refType = of || type;
                if (refType && refType.isObjectTemplate && PersistObjectTemplate._persistProperty(defineProperty)) {
                    var isCrossDocRef = PersistObjectTemplate.isCrossDocRef(template, prop, defineProperty);
                    if (isCrossDocRef || defineProperty.autoFetch) {
                        (function () {
                            var closureProp = prop;
                            var closureFetch = defineProperty.fetch ? defineProperty.fetch : {};
                            var closureQueryOptions = defineProperty.queryOptions ? defineProperty.queryOptions : {};
                            var toClient = !(defineProperty.isLocal || (defineProperty.toClient === false));
                            if (!props[closureProp + 'Persistor']) {
                                template.createProperty(closureProp + 'Persistor', {
                                    type: Object, toClient: toClient,
                                    toServer: false, persist: false,
                                    value: { isFetched: defineProperty.autoFetch ? false : true, isFetching: false }
                                });
                            }
                            if (!template.prototype[closureProp + 'Fetch'])
                                template.createProperty(closureProp + 'Fetch', {
                                    on: 'server', body: function (start, limit) {
                                        if (typeof (start) != 'undefined') {
                                            closureQueryOptions['skip'] = start;
                                        }
                                        if (typeof (limit) != 'undefined') {
                                            closureQueryOptions['limit'] = limit;
                                        }
                                        return this.fetchProperty(closureProp, closureFetch, closureQueryOptions);
                                    }
                                });
                        })();
                    }
                }
            }
            this.__propertiesInjected__ = true;
        };
    };
    PersistObjectTemplate._injectObjectFunctions = function (template) {
        var self = this; // this is the objectTemplate for non-TS apps or daemons or other non-sessionized use-cases
        template.prototype.persistSave = // Legacy
            function (txn, logger) {
                var time = getTime();
                var persistObjectTemplate = this.__objectTemplate__ || self;
                (logger || persistObjectTemplate.logger).debug({
                    component: 'persistor', module: 'api', activity: 'persistSave',
                    data: { template: this.__template__.__name__, id: this.__id__ }
                });
                var dbType = persistObjectTemplate.getDB(persistObjectTemplate.getDBAlias(this.__template__.__collection__)).type;
                var query = dbType == persistObjectTemplate.DB_Mongo ?
                    persistObjectTemplate.persistSaveMongo(this, undefined, undefined, undefined, txn, logger)
                        .then(function (obj) {
                        if (txn) {
                            persistObjectTemplate.saved(obj, txn);
                        }
                        return Promise.resolve(obj._id.toString());
                    })
                    : persistObjectTemplate.persistSaveKnex(this, txn, logger)
                        .then(function (obj) {
                        if (txn) {
                            persistObjectTemplate.saved(obj, txn);
                        }
                        return Promise.resolve(obj._id.toString());
                    });
                var name = 'persistSave';
                return query
                    .then(function (result) {
                    getStats(time, template.__name__, name);
                    return result;
                })
                    .catch(function (e) {
                    return getStats(time, template.__name__, name, true);
                });
            };
        template.prototype.persistTouch = // Legacy -- just use persistorSave
            function (txn, logger) {
                return __awaiter(this, void 0, void 0, function () {
                    var time, persistObjectTemplate, dbType, query, name;
                    return __generator(this, function (_a) {
                        time = getTime();
                        persistObjectTemplate = this.__objectTemplate__ || self;
                        (logger || persistObjectTemplate.logger).debug({
                            component: 'persistor', module: 'api', activity: 'persistTouch',
                            data: { template: this.__template__.__name__, id: this.__id__ }
                        });
                        dbType = persistObjectTemplate.getDB(persistObjectTemplate.getDBAlias(this.__template__.__collection__)).type;
                        query = dbType == persistObjectTemplate.DB_Mongo ?
                            persistObjectTemplate.persistSaveMongo(this, undefined, undefined, undefined, txn, logger)
                            : persistObjectTemplate.persistTouchKnex(this, txn, logger);
                        name = 'persistTouch';
                        return [2 /*return*/, query
                                .then(function (result) {
                                getStats(time, template.__name__, name);
                                return result;
                            })
                                .catch(function (e) {
                                return getStats(time, template.__name__, name, true);
                            })];
                    });
                });
            };
        //persistDelete is modified to support both legacy and V2, options this is passed for V2 as the first parameter.
        template.prototype.persistDelete = // Legacy
            function (txn, logger) {
                return __awaiter(this, void 0, void 0, function () {
                    var time, persistObjectTemplate, query, name;
                    return __generator(this, function (_a) {
                        time = getTime();
                        persistObjectTemplate = this.__objectTemplate__ || self;
                        if (!txn || (txn && txn.knex && txn.knex.transacting)) {
                            (logger || persistObjectTemplate.logger).debug({
                                component: 'persistor', module: 'api', activity: 'persistDelete',
                                data: { template: this.__template__.__name__, id: this.__id__ }
                            });
                            if (txn) {
                                delete txn.dirtyObjects[this.__id__];
                            }
                            query = this.__template__.deleteFromPersistWithId(this._id, txn, logger);
                        }
                        else {
                            //for V2 options are passed as the first paramter.
                            query = this.deleteV2.call(this, txn);
                        }
                        name = 'persistDelete';
                        return [2 /*return*/, query
                                .then(function (result) {
                                getStats(time, template.__name__, name);
                                return result;
                            })
                                .catch(function (e) {
                                return getStats(time, template.__name__, name, true);
                            })];
                    });
                });
            };
        // Legacy
        template.prototype.setDirty = function (txn, onlyIfChanged, cascade, logger) {
            var persistObjectTemplate = this.__objectTemplate__ || self;
            persistObjectTemplate.setDirty(this, txn, onlyIfChanged, !cascade, logger);
        };
        template.prototype.setAsDeleted = function (txn, onlyIfChanged) {
            var persistObjectTemplate = this.__objectTemplate__ || self;
            persistObjectTemplate.setAsDeleted(this, txn, onlyIfChanged);
        };
        // Legacy 
        template.prototype.cascadeSave = function (txn, logger) {
            var time = getTime();
            var persistObjectTemplate = this.__objectTemplate__ || self;
            var query = persistObjectTemplate.setDirty(this, txn || persistObjectTemplate.currentTransaction, true, false, logger);
            var name = 'cascadeSave';
            return query
                .then(function (result) {
                getStats(time, template.__name__, name);
                return result;
            })
                .catch(function (e) {
                return getStats(time, template.__name__, name, true);
            });
        };
        template.prototype.isStale = // Legacy
            template.prototype.persistorIsState = function () {
                var time = getTime();
                var name = 'isStale';
                var persistObjectTemplate = this.__objectTemplate__ || self;
                var dbType = persistObjectTemplate.getDB(persistObjectTemplate.getDBAlias(this.__template__.__collection__)).type;
                return this.__template__.countFromPersistWithQuery({
                    _id: (dbType == persistObjectTemplate.DB_Mongo) ? persistObjectTemplate.ObjectID(this._id.toString()) : this._id,
                    __version__: this.__version__
                }).then(function (count) {
                    return !count;
                }.bind(this))
                    .then(function (result) {
                    getStats(time, template.__name__, name);
                    return result;
                })
                    .catch(function (e) {
                    return getStats(time, template.__name__, name, true);
                });
            };
        // Legacy
        template.prototype.fetchProperty = function (prop, cascade, queryOptions, isTransient, idMap, logger) {
            return __awaiter(this, void 0, void 0, function () {
                var persistObjectTemplate, time, properties, objectProperties, cascadeTop, dbType, promise, name;
                return __generator(this, function (_a) {
                    persistObjectTemplate = this.__objectTemplate__ || self;
                    time = getTime();
                    (logger || persistObjectTemplate.logger).debug({
                        component: 'persistor', module: 'api', activity: 'fetchProperty',
                        data: { template: this.__template__.__name__, id: this.__id__ }
                    });
                    idMap = idMap || {};
                    properties = {};
                    objectProperties = this.__template__.getProperties();
                    properties[prop] = objectProperties[prop];
                    if (queryOptions) {
                        properties[prop].queryOptions = queryOptions;
                    }
                    cascadeTop = {};
                    cascadeTop[prop] = cascade || true;
                    dbType = persistObjectTemplate.getDB(persistObjectTemplate.getDBAlias(this.__template__.__collection__)).type;
                    promise = dbType == persistObjectTemplate.DB_Mongo ?
                        persistObjectTemplate.getTemplateFromMongoPOJO(this, this.__template__, null, null, idMap, cascadeTop, this, properties, isTransient, logger) :
                        persistObjectTemplate.getTemplateFromKnexPOJO(this, this.__template__, null, idMap, cascadeTop, isTransient, null, this, properties, undefined, undefined, undefined, logger);
                    name = 'fetchProperty';
                    return [2 /*return*/, promise.then(function (result) {
                            getStats(time, template.__name__, name);
                            return result;
                        })
                            .catch(function (e) {
                            return getStats(time, template.__name__, name, true);
                        })];
                });
            });
        };
        template.prototype.fetch = function (cascade, isTransient, idMap, logger) {
            return __awaiter(this, void 0, void 0, function () {
                var persistObjectTemplate, time, properties, objectProperties, prop, dbType, previousDirtyTracking, promise, name;
                return __generator(this, function (_a) {
                    persistObjectTemplate = this.__objectTemplate__ || self;
                    time = getTime();
                    (logger || persistObjectTemplate.logger).debug({
                        component: 'persistor', module: 'api', activity: 'fetch',
                        data: { template: this.__template__.__name__, id: this.__id__ }
                    });
                    idMap = idMap || {};
                    properties = {};
                    objectProperties = this.__template__.getProperties();
                    for (prop in cascade) {
                        properties[prop] = objectProperties[prop];
                    }
                    dbType = persistObjectTemplate.getDB(persistObjectTemplate.getDBAlias(this.__template__.__collection__)).type;
                    previousDirtyTracking = persistObjectTemplate.__changeTracking__;
                    persistObjectTemplate.__changeTracking__ = false;
                    promise = (dbType == persistObjectTemplate.DB_Mongo ?
                        persistObjectTemplate.getTemplateFromMongoPOJO(this, this.__template__, null, null, idMap, cascade, this, properties, isTransient, logger) :
                        persistObjectTemplate.getTemplateFromKnexPOJO(this, this.__template__, null, idMap, cascade, isTransient, null, this, properties, undefined, undefined, undefined, logger))
                        .then(function (res) {
                        return res;
                    })
                        .finally(function () {
                        persistObjectTemplate.__changeTracking__ = previousDirtyTracking;
                    });
                    name = 'fetch';
                    return [2 /*return*/, promise.then(function (result) {
                            getStats(time, template.__name__, name);
                            return result;
                        })
                            .catch(function (e) {
                            return getStats(time, template.__name__, name, true);
                        })];
                });
            });
        };
        template.prototype.persistorFetchReferences = template.prototype.fetchReferences = function (options) {
            return __awaiter(this, void 0, void 0, function () {
                var persistObjectTemplate, time, logger, properties, objectProperties, prop, dbType, promise, name;
                return __generator(this, function (_a) {
                    persistObjectTemplate = this.__objectTemplate__ || self;
                    persistObjectTemplate._validateParams(options, 'fetchSchema', this.__template__);
                    time = getTime();
                    options = options || {};
                    logger = options.logger || persistObjectTemplate.logger;
                    logger.debug({
                        component: 'persistor', module: 'api', activity: 'fetchReferences',
                        data: { template: this.__template__.__name__, id: this.__id__ }
                    });
                    properties = {};
                    objectProperties = this.__template__.getProperties();
                    for (prop in options.fetch) {
                        properties[prop] = objectProperties[prop];
                    }
                    dbType = persistObjectTemplate.getDB(persistObjectTemplate.getDBAlias(this.__template__.__collection__)).type;
                    promise = (dbType == persistObjectTemplate.DB_Mongo ?
                        persistObjectTemplate.getTemplateFromMongoPOJO(this, this.__template__, null, null, {}, options.fetch, this, properties, options.transient, logger) :
                        persistObjectTemplate.getTemplateFromKnexPOJO(this, this.__template__, null, {}, options.fetch, options.transient, null, this, properties, undefined, undefined, undefined, logger));
                    name = 'persistorFetchReferences';
                    return [2 /*return*/, promise.then(function (result) {
                            getStats(time, template.__name__, name);
                            return result;
                        })
                            .catch(function (e) {
                            return getStats(time, template.__name__, name, true);
                        })];
                });
            });
        };
        template.prototype.persistorRefresh = template.prototype.refresh = function (logger) {
            return __awaiter(this, void 0, void 0, function () {
                var persistObjectTemplate, time, dbType, promise, name;
                return __generator(this, function (_a) {
                    persistObjectTemplate = this.__objectTemplate__ || self;
                    time = getTime();
                    (logger || persistObjectTemplate.logger).debug({
                        component: 'persistor', module: 'api', activity: 'refresh',
                        data: { template: this.__template__.__name__, id: this.__id__ }
                    });
                    dbType = persistObjectTemplate.getDB(persistObjectTemplate.getDBAlias(template.__collection__)).type;
                    promise = (dbType == PersistObjectTemplate.DB_Mongo ?
                        persistObjectTemplate.getFromPersistWithMongoId(template, this._id, null, null, null, logger) :
                        persistObjectTemplate.getFromPersistWithKnexId(template, this._id, null, null, null, true, logger));
                    name = 'persistorRefresh';
                    promise.then(function (result) {
                        getStats(time, template.__name__, name);
                        return result;
                    })
                        .catch(function (e) {
                        return getStats(time, template.__name__, name, true);
                    });
                    return [2 /*return*/];
                });
            });
        };
        template.prototype.persistorSave = template.prototype.persist = function (options) {
            return __awaiter(this, void 0, void 0, function () {
                var time, persistObjectTemplate, txn, cascade, logger, promise, name;
                return __generator(this, function (_a) {
                    time = getTime();
                    persistObjectTemplate = this.__objectTemplate__ || self;
                    persistObjectTemplate._validateParams(options, 'persistSchema', this.__template__);
                    options = options || {};
                    txn = persistObjectTemplate.getCurrentOrDefaultTransaction(options.transaction);
                    cascade = options.cascade;
                    logger = options.logger || persistObjectTemplate.logger;
                    logger.debug({
                        component: 'persistor', module: 'api', activity: 'save',
                        data: { template: this.__template__.__name__, id: this.__id__ }
                    });
                    if (!txn) {
                        promise = this.persistSave(null, logger);
                    }
                    else {
                        promise = Promise.resolve(this.setDirty(txn, false, cascade, logger));
                    }
                    name = 'persistorSave';
                    return [2 /*return*/, promise.then(function (result) {
                            getStats(time, template.__name__, name);
                            return result;
                        })
                            .catch(function (e) {
                            return getStats(time, template.__name__, name, true);
                        })];
                });
            });
        };
        /**
         * Can generate object id even before saving the record to the database.
         * @returns {string}
         */
        template.prototype.generateId = function () {
            var persistObjectTemplate = this.__objectTemplate__ || self;
            return (this._id = this._id || persistObjectTemplate.createPrimaryKey(this));
        };
        //persistorDelete will only support new API calls.
        template.prototype.persistorDelete = template.prototype.deleteV2 = function (options) {
            return __awaiter(this, void 0, void 0, function () {
                var time, persistObjectTemplate, txn, cascade, logger, promise, name;
                return __generator(this, function (_a) {
                    time = getTime();
                    persistObjectTemplate = this.__objectTemplate__ || self;
                    persistObjectTemplate._validateParams(options, 'persistSchema', this.__template__);
                    options = options || {};
                    txn = persistObjectTemplate.getCurrentOrDefaultTransaction(options.transaction);
                    cascade = options.cascade;
                    logger = options.logger || persistObjectTemplate.logger;
                    logger.debug({
                        component: 'persistor', module: 'api', activity: 'delete',
                        data: { template: this.__template__.__name__, id: this.__id__ }
                    });
                    if (!txn) {
                        promise = this.__template__.deleteFromPersistWithId(this._id, null, logger);
                    }
                    else {
                        promise = Promise.resolve(persistObjectTemplate.setAsDeleted(this, txn, false, !cascade, logger));
                    }
                    name = 'persistorDelete';
                    return [2 /*return*/, promise.then(function (result) {
                            getStats(time, template.__name__, name);
                            return result;
                        })
                            .catch(function (e) {
                            return getStats(time, template.__name__, name, true);
                        })];
                });
            });
        };
        // Add persistors to foreign key references
        if (template.defineProperties && typeof (template._injectProperties) == 'function')
            template._injectProperties();
    };
    /**
     * PUBLIC INTERFACE FOR objectTemplate
     */
    /**
     * Begin a transaction that will ultimately be ended with end. It is passed into setDirty so
     * dirty objects can be accumulated.  Does not actually start a knex transaction until end
     * @param {bool} notDefault used for marking the transaction created as the default transaction
     * @returns {object} returns transaction object
     */
    PersistObjectTemplate.begin = function (notDefault) {
        var txn = { id: new Date().getTime(), dirtyObjects: {}, savedObjects: {}, touchObjects: {}, deletedObjects: {} };
        if (!notDefault) {
            this.currentTransaction = txn;
        }
        return txn;
    };
    PersistObjectTemplate.end = function (persistorTransaction, logger) {
        persistorTransaction = persistorTransaction || this.currentTransaction;
        logger = logger || PersistObjectTemplate.logger;
        return PersistObjectTemplate.commit({ transaction: persistorTransaction, logger: logger });
    };
    /**
     * Set the object dirty along with all descendant objects in the logical "document"
     *
     * @param {supertype} obj objecttempate
     * @param {object} txn persistobjecttemplate transaction object
     * @param {bool} onlyIfChanged mark dirty only if changed
     * @param {bool} noCascade, avoids loading children
     * @param {object} logger objecttemplate logger
     */
    PersistObjectTemplate.setDirty = function (obj, txn, onlyIfChanged, noCascade, logger) {
        var topObject;
        // Get array references too
        if (onlyIfChanged && this.MarkChangedArrayReferences) {
            this.MarkChangedArrayReferences();
        }
        txn = txn || this.currentTransaction;
        if (!obj || !obj.__template__.__schema__) {
            return;
        }
        // Use the current transaction if none passed
        txn = txn || PersistObjectTemplate.currentTransaction || null;
        if (!onlyIfChanged || obj.__changed__) {
            (txn ? txn.dirtyObjects : this.dirtyObjects)[obj.__id__] = obj;
        }
        if (txn && obj.__template__.__schema__.cascadeSave && !noCascade) {
            // Potentially cascade to set other related objects as dirty
            topObject = PersistObjectTemplate.getTopObject(obj);
            if (!topObject) {
                (logger || this.logger).error({ component: 'persistor', module: 'api', activity: 'setDirty' }, 'Warning: setDirty called for ' + obj.__id__ + ' which is an orphan');
            }
            if (topObject && topObject.__template__.__schema__.cascadeSave) {
                PersistObjectTemplate.enumerateDocumentObjects(PersistObjectTemplate.getTopObject(obj), function (obj) {
                    if (!onlyIfChanged || obj.__changed__) {
                        (txn ? txn.dirtyObjects : this.dirtyObjects)[obj.__id__] = obj;
                        // Touch the top object if required so that if it will be modified and can be refereshed if needed
                        if (txn && txn.touchTop && obj.__template__.__schema__) {
                            var topObject = PersistObjectTemplate.getTopObject(obj);
                            if (topObject) {
                                txn.touchObjects[topObject.__id__] = topObject;
                            }
                        }
                    }
                }.bind(this));
            }
        }
        if (txn && txn.touchTop && obj.__template__.__schema__) {
            topObject = PersistObjectTemplate.getTopObject(obj);
            if (topObject) {
                txn.touchObjects[topObject.__id__] = topObject;
            }
        }
    };
    PersistObjectTemplate.setAsDeleted = function (obj, txn, onlyIfChanged) {
        // Get array references too
        if (onlyIfChanged && this.MarkChangedArrayReferences) {
            this.MarkChangedArrayReferences();
        }
        txn = txn || this.__defaultTransaction__;
        if (!obj || !obj.__template__.__schema__) {
            return;
        }
        if (!onlyIfChanged || obj.__deleted__) {
            (txn ? txn.deletedObjects : this.deletedObjects)[obj.__id__] = obj;
        }
        //Do we need to support cascase delete, if so we need to check the dependencies and delete them.
    };
    PersistObjectTemplate.saveAll = function (txn, logger) {
        return __awaiter(this, void 0, void 0, function () {
            var time, promises, somethingSaved, dirtyObjects, id;
            return __generator(this, function (_a) {
                time = getTime();
                promises = [];
                somethingSaved = false;
                dirtyObjects = txn ? txn.dirtyObjects : this.dirtyObjects;
                for (id in dirtyObjects) {
                    (function () {
                        var obj = dirtyObjects[id];
                        delete dirtyObjects[obj.__id__];
                        promises.push(obj.persistSave(txn, logger).then(function () {
                            PersistObjectTemplate.saved(obj, txn);
                            somethingSaved = true;
                        }));
                    })();
                }
                return [2 /*return*/, Promise.all(promises)
                        .then(function () {
                        if (!somethingSaved && txn && txn.postSave) {
                            txn.postSave(txn, logger);
                            this.dirtyObjects = {};
                            this.savedObjects = {};
                        }
                        if (somethingSaved) {
                            return this.saveAll(txn);
                        }
                        else {
                            return true;
                        }
                    }.bind(this))
                        .then(function (result) {
                        getStats(time, 'PersistObjectTemplate', 'saveAll');
                        return result;
                    })
                        .catch(function (e) {
                        return getStats(time, 'PersistObjectTemplate', 'saveAll', true);
                    })];
            });
        });
    };
    /**
     * Set a data base to be used
     * @param {knex|mongoclient} db - the native client objects used
     * @param {knex|mongo} type - the type which is defined in index.js
     * @param {pg|mongo|__default} alias - An alias that can be used in the schema to specify the database at a table level
     */
    PersistObjectTemplate.setDB = function (db, type, alias) {
        type = type || PersistObjectTemplate.DB_Mongo;
        alias = alias || '__default__';
        this._db = this._db || {};
        this._db[alias] = { connection: db, type: type };
    };
    /**
     * retrieve a PLain Old Javascript Object given a query
     * @param {SuperType} template - template to load
     * @param {json|function} query - can pass either mongo style queries or callbacks to add knex calls..
     * @param {json} options - sort, limit, and offset options
     * @param {ObjectTemplate.logger} logger - objecttemplate logger
     * @returns {*}
     */
    PersistObjectTemplate.getPOJOFromQuery = function (template, query, options, logger) {
        return __awaiter(this, void 0, void 0, function () {
            var dbType, prefix;
            return __generator(this, function (_a) {
                dbType = PersistObjectTemplate.getDB(PersistObjectTemplate.getDBAlias(template.__collection__)).type;
                prefix = PersistObjectTemplate.dealias(template.__collection__);
                return [2 /*return*/, dbType == PersistObjectTemplate.DB_Mongo ?
                        PersistObjectTemplate.getPOJOFromMongoQuery(template, query, options, logger) :
                        PersistObjectTemplate.getPOJOsFromKnexQuery(template, [], query, options, undefined, logger).then(function (pojos) {
                            pojos.forEach(function (pojo) {
                                _.map(pojo, function (_val, prop) {
                                    if (prop.match(RegExp('^' + prefix + '___'))) {
                                        pojo[prop.replace(RegExp('^' + prefix + '___'), '')] = pojo[prop];
                                        delete pojo[prop];
                                    }
                                });
                            });
                            return pojos;
                        })];
            });
        });
    };
    PersistObjectTemplate.beginTransaction = function () {
        var txn = {
            id: new Date().getTime(), dirtyObjects: {},
            savedObjects: {}, touchObjects: {}, deletedObjects: {}, deleteQueries: {}
        };
        return txn;
    };
    PersistObjectTemplate.beginDefaultTransaction = function () {
        this.__defaultTransaction__ = { id: new Date().getTime(), dirtyObjects: {}, savedObjects: {}, touchObjects: {}, deletedObjects: {} };
        return this.__defaultTransaction__;
    };
    PersistObjectTemplate.commit = function commit(options) {
        return __awaiter(this, void 0, void 0, function () {
            var time, logger, persistorTransaction, promise, name;
            return __generator(this, function (_a) {
                time = getTime();
                PersistObjectTemplate._validateParams(options, 'commitSchema');
                options = options || {};
                logger = options.logger || PersistObjectTemplate.logger;
                persistorTransaction = options.transaction || this.__defaultTransaction__;
                if (PersistObjectTemplate.DB_Knex) {
                    promise = PersistObjectTemplate._commitKnex(persistorTransaction, logger, options.notifyChanges);
                }
                name = 'commit';
                return [2 /*return*/, promise.then(function (result) {
                        getStats(time, 'PersistObjectTemplate', name);
                        return result;
                    })
                        .catch(function (e) {
                        return getStats(time, 'PersistObjectTemplate', name, true);
                    })];
            });
        });
    };
    /**
     * Mostly used for unit testing.  Does a knex connect, schema setup and injects templates
     * @param {object} config knex connection
     * @param {JSON} schema data model definitions
     * @returns {*}
     */
    PersistObjectTemplate.connect = function (config, schema) {
        var knex = require('knex');
        var connection = knex(config);
        this.setDB(connection, this.DB_Knex, config.client);
        this.setSchema(schema);
        this.performInjections(); // Normally done by getTemplates
        return connection;
    };
    /**
     * Mostly used for unit testing.  Drops all tables for templates that have a schema
     * @returns {*|Array}
     */
    PersistObjectTemplate.dropAllTables = function () {
        return this.onAllTables(function (template) {
            return this.dropKnexTable(template);
        }.bind(this));
    };
    /**
     * Mostly used for unit testing.  Synchronize all tables for templates that have a schema
     * @returns {*|Array}
     */
    PersistObjectTemplate.syncAllTables = function () {
        return this.onAllTables(function (template) {
            return this.synchronizeKnexTableFromTemplate(template);
        }.bind(this));
    };
    /**
     * Mostly used for unit testing.  Synchronize all tables for templates that have a schema
     * @param {string} action common actions
     * @param {string} concurrency #parallel
     * @returns {*|Array}
     */
    PersistObjectTemplate.onAllTables = function (action, concurrency) {
        var templates = [];
        _.each(this.__dictionary__, drop);
        function drop(template) {
            if (template.__schema__ && (!template.__schema__.documentOf || !template.__schema__.documentOf.match(/not persistent/i))) {
                templates.push(template);
            }
        }
        return Promise.map(templates, action, { concurrency: concurrency || 1 });
    };
};