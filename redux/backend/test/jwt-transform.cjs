const ts = require('typescript');

// Jest uses CommonJS. The installed Nest JWT package publishes ESM.
module.exports = {
  process(source) {
    return {code: ts.transpileModule(source, {compilerOptions: {
      module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true,
    }}).outputText};
  },
};
