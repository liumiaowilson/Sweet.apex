const fs = require('fs');
const path = require('path');
const _ = require('lodash');
const AST = require('../ast');
const { time, timeEnd, } = require('../utils');

let features = null;

const loadFeatures = () => {
    const features = {};

    _.each(fs.readdirSync(__dirname), fileName => {
        if(fileName === 'index.js') {
            return;
        }

        const name = fileName.endsWith('.js') ? fileName.substring(0, fileName.length - 3) : fileName;
        const feature = require('.' + path.sep + fileName);
        feature.name = name;
        features[name] = feature;
    });

    return features;
};

const accept = (context, feature) => {
    if(_.isFunction(feature.accept)) {
        return feature.accept(context);
    }

    return false;
};

const run = (context, feature) => {
    if(_.isFunction(feature.run)) {
        feature.run(context);
    }
};

const runGroup = (group, feature) => {
    if(_.isFunction(feature.runGroup)) {
        feature.runGroup(group);
    }
};

const rebuildWithFeature = (node, feature, config) => {
    const collected = [];

    AST.traverse(node, (current, parent) => {
        const context = {
            current,
            parent: parent || {},
            root: node || {},
            config,
        };

        if(accept(context, feature)) {
            collected.push(context);
        }
    });

    if(!_.isEmpty(collected)) {
        if(_.isFunction(feature.groupBy)) {
            const groups = _.groupBy(collected, feature.groupBy);

            _.each(groups, group => {
                runGroup(group, feature);
            });
        }
        else {
            _.each(collected, context => {
                run(context, feature);
            });
        }
    }
};

const rebuild = (node, config) => {
    if(!node) {
        throw new Error('Node does not exist');
    }

    const fList = config.features;

    if(!features) {
        features = loadFeatures();
    }

    time('Add index', config);
    AST.addIndex(node);
    timeEnd('Add index', config);

    _.each(fList, featureName => {
        const feature = features[featureName];
        if(!feature) {
            throw new Error(`No such feature "${featureName}" cound be found`);
        }

        time(`Rebuild with ${featureName}`, config);
        rebuildWithFeature(node, feature, config);
        timeEnd(`Rebuild with ${featureName}`, config);
    });

    time('Remove index', config);
    AST.removeIndex(node);
    timeEnd('Remove index', config);
};

module.exports = rebuild;
