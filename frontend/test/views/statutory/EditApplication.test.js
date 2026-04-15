const fs = require('fs');
const path = require('path');
const Module = require('module');

const { parseComponent } = require('vue-template-compiler');

const flushPromises = async () => {
  await new Promise(resolve => setImmediate(resolve));
  await new Promise(resolve => setImmediate(resolve));
};

function loadEditApplicationComponent () {
  const filePath = path.resolve(__dirname, '../../../src/views/statutory/EditApplication.vue');
  const source = fs.readFileSync(filePath, 'utf8');
  const parsed = parseComponent(source);

  let script = parsed.script.content;
  script = script.replace("import { mapGetters } from 'vuex'", 'const mapGetters = () => ({})');
  script = script.replace(
    "import nationalities from '../../nationalities'",
    `const nationalities = require(${JSON.stringify(path.resolve(__dirname, '../../../src/nationalities.json'))})`
  );
  script = script.replace(
    "import EventNoBodyNotification from '../../components/notifications/EventNoBodyNotification'",
    'const EventNoBodyNotification = {}'
  );
  script = script.replace('export default', 'module.exports =');

  const loadedModule = new Module(filePath, module);
  loadedModule.filename = filePath;
  loadedModule.paths = Module._nodeModulePaths(path.dirname(filePath));
  loadedModule._compile(script, filePath);

  return loadedModule.exports;
}

function createVm ({ component, axios }) {
  const vm = {
    ...component.data(),
    axios,
    services: {
      statutory: 'https://statutory.test',
      core: 'https://core.test'
    },
    loginUser: {
      id: 9,
      primary_body_id: 9,
      bodies: [
        { id: 9, name: 'Chair Team' },
        { id: 34, name: 'AEGEE-Alicante' }
      ]
    },
    $route: {
      params: {
        id: '42',
        application_id: '1337'
      }
    },
    $root: {
      showError: jest.fn()
    },
    $router: {
      push: jest.fn()
    }
  };

  Object.entries(component.methods).forEach(([name, fn]) => {
    vm[name] = fn.bind(vm);
  });

  Object.defineProperty(vm, 'isNew', {
    get: () => component.computed.isNew.call(vm)
  });

  Object.defineProperty(vm, 'isOwn', {
    get: () => component.computed.isOwn.call(vm)
  });

  Object.defineProperty(vm, 'selectedMailinglists', {
    get: () => component.computed.selectedMailinglists.call(vm)
  });

  return vm;
}

describe('statutory EditApplication bodies', () => {
  test('uses the application user bodies from the fetched member response', async () => {
    const component = loadEditApplicationComponent();
    const axios = {
      get: jest.fn((url) => {
        if (url === 'https://statutory.test/events/42') {
          return Promise.resolve({
            data: {
              data: {
                questions: [],
                permissions: {
                  apply_from_body: {
                    9: true,
                    34: true
                  }
                }
              }
            }
          });
        }

        if (url === 'https://statutory.test/events/42/applications/1337') {
          return Promise.resolve({
            data: {
              data: {
                id: 1337,
                user_id: 1337,
                permissions: {
                  apply_from_body: {
                    1: true,
                    34: true
                  }
                }
              }
            }
          });
        }

        if (url === 'https://core.test/members/1337') {
          return Promise.resolve({
            data: {
              data: {
                bodies: [
                  { id: 1, name: 'AEGEE-Test' },
                  { id: 34, name: 'AEGEE-Alicante' }
                ]
              }
            }
          });
        }

        return Promise.reject(new Error(`Unexpected URL: ${url}`));
      })
    };

    const vm = createVm({ component, axios });

    component.mounted.call(vm);
    await flushPromises();

    expect(vm.bodies).toEqual([
      { id: 1, name: 'AEGEE-Test' },
      { id: 34, name: 'AEGEE-Alicante' }
    ]);
    expect(vm.bodies.map(body => body.id)).not.toContain(9);
  });
});
