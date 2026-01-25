"use strict";

var _process = _interopRequireDefault(require("process"));
var _yargs = require("../core/yargs");
var _helpers = _interopRequireDefault(require("../helpers"));
var _fs = _interopRequireDefault(require("fs"));
var _picocolors = _interopRequireDefault(require("picocolors"));
function _interopRequireDefault(e) { return e && e.__esModule ? e : { default: e }; }
exports.builder = yargs => (0, _yargs._underscoreOption)((0, _yargs._baseOptions)(yargs).option('name', {
  describe: 'Defines the name of the migration',
  type: 'string',
  demandOption: true
})).argv;
exports.handler = function (args) {
  _helpers.default.init.createMigrationsFolder();
  _fs.default.writeFileSync(_helpers.default.path.getMigrationPath(args.name), _helpers.default.template.render('migrations/skeleton.js', {}, {
    beautify: false
  }));
  _helpers.default.view.log('New migration was created at', _picocolors.default.blueBright(_helpers.default.path.getMigrationPath(args.name)), '.');
  _process.default.exit(0);
};