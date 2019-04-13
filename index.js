const fs = require('fs');
const babylon = require('@babel/parser');
const traverse = require('@babel/traverse').default;
const path = require('path');
const babel = require('@babel/core');

/**
 *
 * @typedef {Object} Module
 * @property {String} id
 * @property {String} code
 * @property {Object} mapping
 *
 * @return {Module[]} modules
 */
function dependencyGraph(entry) {
  let ID = 0;
  const module = {
    id: ID,
    abPath: path.resolve(entry),
    mapping: {
    },
  };
  const modules = [module];
  for (const item of modules) {
    const code = fs.readFileSync(item.abPath, 'utf-8');
    const ast = babylon.parse(code, {
      sourceType: 'module',
    });
    const {
      code: transformedCode,
    } = babel.transformFromAstSync(ast, code, {
      presets: [
        '@babel/preset-env',
      ],
    });
    item.code = transformedCode;
    traverse(ast, {
      ImportDeclaration(astPath) {
        ID++;
        const relativePath = astPath.node.source.value;
        item.mapping[relativePath] = ID;
        const childModule = {
          id: ID,
          abPath: require.resolve(path.resolve(path.dirname(entry), relativePath)),
          mapping: {
          },
        };
        modules.push(childModule);
      },
    });
  }

  return modules;
}

function createBundle(entry) {
  const graph = dependencyGraph(entry);
  // console.log(graph);
  const modules = graph.reduce((acc, module, index) => {
    acc += `${module.id}: [
      function(require, module, exports) {
        ${module.code}
        return module.exports;
      },
      ${JSON.stringify(module.mapping)},
    ]`;
    if (index !== graph.length - 1) {
      acc += ',';
    }
    return acc;
  }, '');
  const result = `(function(modules) {
    const require = function(id) {
      const [fn, mapping] = modules[id];
      const localRequire = function(relativePath) {
        return require(mapping[relativePath]);
      };
      const module = {
        exports: {},
      };
      return (fn)(localRequire, module,module.exports);
    }
    require(0);
    // console.log(modules);
  })({${modules}})`;
  return result;
}

const bundleStr = createBundle('./src/index.js');
console.log(bundleStr);
