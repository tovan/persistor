import * as _ from 'underscore';
import { PersistObjectTemplate } from './PersistObjectTemplate';


function getBaseClass(template) {
    while (template.__parent__) {
        template = template.__parent__
    }

    return template;
}


export namespace Schema {

    export function setSchema(persistor: typeof PersistObjectTemplate, schema) {
        persistor._schema = schema;
    }

    export function appendSchema(persistor: typeof PersistObjectTemplate, schema) {
        Object.keys(schema).forEach(key => {
            persistor._schema[key] = schema[key];
        });

        persistor._verifySchema();
    }

    /**
    * Run through the schema entries and setup these properites on templates
    *  __schema__: the schema for each template
    *  __collection__: the name of the Mongo Collection
    *  __topTemplate__: for a template that represents a subDocument the template that is primary for that colleciton
    */
    export function _verifySchema(persistor: typeof PersistObjectTemplate) {
        var templateName, template, key, defaultTable;
        var schema = persistor._schema;

        if (!schema) {
            return;
        }

        // Establish a hash of collections keyed by collection name that has the main template for the collection
        var collections = {};
        for (templateName in schema) {
            template = persistor.getTemplateByName(templateName);
            if (template && schema[templateName].documentOf) {

                if (collections[schema[templateName].documentOf] && collections[schema[templateName].documentOf] != getBaseClass(template)) {
                    throw new Error(`${templateName} and ${collections[schema[templateName].documentOf]._name} are both defined to be top documents of ${schema[templateName].documentOf}`);
                }
                
                collections[schema[templateName].documentOf] = getBaseClass(template);
            }
        }

        // For any templates with subdocuments fill in the __topTemplate__
        for (templateName in schema) {
            template = persistor.getTemplateByName(templateName)
            if (template && schema[templateName].subDocumentOf)
                template.__topTemplate__ = collections[schema[templateName].subDocumentOf];
        }

        // Fill in the __schema__ and __collection properties
        for (templateName in persistor._schema) {

            template = persistor.__dictionary__[templateName];

            if (template) {
                template.__schema__ = persistor._schema[template.__name__];
                template.__collection__ = template.__schema__ ?
                    template.__schema__.documentOf || template.__schema__.subDocumentOf || template.__name__ : null;
                
                if (template.__schema__ && template.__schema__.table) {
                    template.__table__ = template.__schema__.table;
                }

                var parentTemplate = template.__parent__;
                defaultTable = template.__schema__ ? template.__schema__.documentOf || template.__schema__.subDocumentOf || template.__name__ : null;

                // Inherit foreign keys and tables from your parents
                while (parentTemplate) {
                    schema = parentTemplate.__schema__;
                    if (schema && schema.children) {
                        if (!template.__schema__)
                            template.__schema__ = {};
                        if (!template.__schema__.children)
                            template.__schema__.children = [];
                        for (key in schema.children)
                            template.__schema__.children[key] = schema.children[key];
                    }
                    if (schema && schema.parents) {
                        if (!template.__schema__)
                            template.__schema__ = {};
                        if (!template.__schema__.parents)
                            template.__schema__.parents = [];
                        for (key in schema.parents)
                            template.__schema__.parents[key] = schema.parents[key];
                    }

                    defaultTable = schema ? schema.documentOf || schema.subDocumentOf || parentTemplate.__name__ : defaultTable;
                    parentTemplate = parentTemplate.__parent__;
                }
                template.__table__ = template.__schema__ ? template.__schema__.table || defaultTable : defaultTable;
            }
        }
        // Add indexes for one-to-many foreign key relationships, primary keys automatically added by syncTable
        if (!persistor.noAutoIndex && !persistor._schema.__indexed__) {
            var indexes = {}

            for (templateName in persistor._schema) {
                
                template = persistor.__dictionary__[templateName];
                if (template) {
                    addFKIndexes.call(persistor, persistor._schema[templateName], template, templateName)
                }
            }
        }
        
        persistor._schema.__indexed__ = true;


        function addFKIndexes(schema, template, _templateName) {

            // Some folks may not want this
            if (!schema.noAutoIndex)
                _.map(schema.parents, addIndex.bind(this));

            // For a given parent relationship in the schema decide if an index should be added
            function addIndex(val, prop) {

                // To get only one-to-many keys find the corresponding children entry and look up by id
                var parentTemplate = template ? template.getProperties()[prop] : null;
                var propType;

                if (parentTemplate && parentTemplate.type) {
                    propType = parentTemplate.type === Array ? parentTemplate.of : parentTemplate.type;
                    if (!propType.__name__) {
                        throw new Error(`getType attribute is missing for ${prop} in ${template.name}`);
                    }
                }

                var parentSchema = (parentTemplate && parentTemplate.type && persistor.__dictionary__[propType.__name__]) ? 
                                        persistor.__dictionary__[propType.__name__].__schema__ : null;

                var isOTM = (parentSchema && parentSchema.children) ?
                    !!_.find(parentSchema.children, function (child: any) { return child.id == val.id }) : false;

                // Add the entry mindful of avoiding duplicates
                schema.indexes = schema.indexes || [];
                var keyName = 'idx_' + schema.table + '_fk_' + val.id;
                if (isOTM && !indexes[keyName]) {
                    indexes[keyName] = true;
                    schema.indexes.push({ name: keyName, def: { columns: [val.id], type: 'index' } });
                }
            }
        }
    }


    export function isCrossDocRef(persistor: typeof PersistObjectTemplate, template, prop, defineProperty) {
        var schema = getSchema(template);
        var type = defineProperty.type;
        var of = defineProperty.of;
        var refType = of || type;
        var refTypeSchema = getSchema(refType);

        if (!schema || !refTypeSchema)  // No schema no persistor
            return false;

        // With knex everything is cross doc
        if (template.isKnex())
            return true;

        var collection = template.__table__ || template.__collection__;
        var childrenRef = schema && schema.children && schema.children[prop];
        var parentsRef = schema && schema.parents && schema.parents[prop];
        var crossChildren = schema && schema.children && schema.children[prop]  && schema.children[prop].crossDocument;
        var crossParent = schema && schema.parents && schema.parents[prop] && schema.parents[prop].crossDocument;
        return (of && of.__collection__ && (((of.__table__ || of.__collection__) != collection) || (childrenRef && crossChildren))) ||
            (type && type.__collection__ && (((type.__table__ || type.__collection__) != collection) || (parentsRef && crossParent)));

        function getSchema(template) {
            if (!template)
                return null;
            while (!template.__schema__ && template.__parent__)
                template = template.__parent__;
            return template.__schema__;
        }
    }


}