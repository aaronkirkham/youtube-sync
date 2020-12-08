const fs = require('fs').promises;

async function readPackageJson(path) {
  const data = await fs.readFile(`${path}/package.json`);
  const package = JSON.parse(data);
  return package.scripts.build;
}

async function build(path) {
  const fn = await readPackageJson(path);
  console.log(path, ':', fn);
  // exec(fn);
}

build('client');
build('server');