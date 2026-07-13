const fs = require('fs'); const path = require('path'); const Ajv2020 = require('ajv/dist/2020');
const result = JSON.parse(fs.readFileSync(path.join(__dirname, 'result.json'), 'utf8'));
const schema = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../../../contracts/result.schema.json'), 'utf8'));
const ajv = new Ajv2020({ allErrors: true, strict: false }); const valid = ajv.validate(schema, result);
if (!valid) { console.error(ajv.errorsText(ajv.errors, { separator: '\n' })); process.exit(1); }
const sum = Object.values(result.scores || {}).reduce((a, b) => a + b, 0);
if (sum !== result.total) { console.error(`score total mismatch: ${sum} !== ${result.total}`); process.exit(1); }
console.log(`result.json valid; score total=${sum}`);
