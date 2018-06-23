const _ = require('lodash');
const fs = require('fs');
const path = require('path');
const transpile = require('./src/transpiler');
const { time, timeEnd, } = require('./src/utils');

const [ , currentFileName, ...args ] = process.argv;

let isDebugEnabled = false;
let isPerfEnabled = false;
let srcDir = null;
let destDir = null;
const suffix = '.apex';

while(true) {
    const arg = _.first(args);
    if(arg === '-v') {
        isDebugEnabled = true;
        _.pullAt(args, 0);
    }
    if(arg === '--perf') {
        isPerfEnabled = true;
        _.pullAt(args, 0);
    }
    else {
        break;
    }
}

srcDir = _.nth(args, 0);
destDir = _.nth(args, 1);

const usage = () => {
    console.error(`Usage: node ${_.chain(currentFileName).split(path.sep).last().value()} <srcDir> <destDir>`);
};

if(!srcDir || !destDir) {
    usage();
    return;
}

if(!fs.existsSync(destDir)) {
    fs.mkdirSync(destDir);
}

const config = {
};

_.assign(config, JSON.parse(fs.readFileSync(__dirname + path.sep + 'config.json', 'utf8')), {
    isDebugEnabled,
    isPerfEnabled,
});

const meta = `<?xml version="1.0" encoding="UTF-8"?>
<ApexClass xmlns="http://soap.sforce.com/2006/04/metadata">
    <apiVersion>${config.apiVersion}</apiVersion>
    <status>Active</status>
</ApexClass>
`;

const writeToFile = (fileName, content) => {
    time(`Write File ${fileName}`, config);

    return new Promise((resolve, reject) => {
        fs.writeFile(destDir + path.sep + fileName, content, (error, data) => {
            timeEnd(`Write File ${fileName}`, config);
            if(error) {
                reject(error);
            }

            resolve(null);
        });
    });
};

const compileFile = fileName => {
    console.log(`Compiling ${fileName} ...`);

    const name = fileName.substring(0, fileName.length - suffix.length);

    time(`Read file ${fileName}`, config);

    return new Promise((resolve, reject) => {
        fs.readFile(srcDir + path.sep + fileName, 'utf8', (error, src) => {
            timeEnd(`Read file ${fileName}`, config);
            if(error) {
                reject(error);
            }

            time(`Transpile`, config);
            const apexClass = transpile(src, config);
            timeEnd(`Transpile`, config);

            Promise.all([
                writeToFile(`${name}.cls`, apexClass, config)
                    .then(() => console.log(`Compiled ${name}.cls`)),
                writeToFile(`${name}.cls-meta.xml`, meta, config)
                    .then(() => console.log(`Compiled ${name}.cls-meta.xml`)),
            ]).then(resolve);
        });
    });
};

const start = Date.now();

Promise.all(
    _.chain(fs.readdirSync(srcDir))
        .filter(name => name.endsWith(suffix))
        .map(compileFile)
        .value()
).then(
    () => {
        const end = Date.now();
        console.log(`Completed after ${end - start} ms`);
    },
    error => console.error(error)
);
