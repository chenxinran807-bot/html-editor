const { execFile } = require('node:child_process');
const { promisify } = require('node:util');
const { mkdtemp, writeFile, readFile, rm } = require('node:fs/promises');
const { tmpdir } = require('node:os');
const { join } = require('node:path');

const execFileAsync = promisify(execFile);

function unwrap(result) {
  if (result && result.ok === false) throw new Error(result.error?.message || 'lark-cli 调用失败');
  return result?.data || result;
}

function createLarkCliAdapter(options = {}) {
  const binary = options.binary || 'lark-cli';
  const prefixArgs = options.prefixArgs || [];
  const execute = options.execFile || execFileAsync;
  async function run(args, runOptions = {}) {
    const { stdout } = await execute(binary, [...prefixArgs, ...args], {
      cwd: runOptions.cwd,
      maxBuffer: 20 * 1024 * 1024,
      env: {
        ...process.env,
        ...(options.env || {}),
        LARKSUITE_CLI_NO_UPDATE_NOTIFIER: '1',
        LARKSUITE_CLI_NO_SKILLS_NOTIFIER: '1'
      }
    });
    return JSON.parse(stdout);
  }
  async function list(folderToken) {
    const result = unwrap(await run([
      'drive', 'files', 'list', '--params', JSON.stringify({ folder_token: folderToken || '', page_size: 200 }),
      '--format', 'json', '--as', 'user'
    ]));
    return result.files || [];
  }
  return {
    async currentUser() {
      const status = await run(['auth', 'status', '--json']);
      const user = status.identities?.user;
      if (!user?.available || !user.openId) throw new Error('飞书用户身份不可用，请先执行 lark-cli auth login');
      return { openId: user.openId, name: user.userName };
    },
    async ensureFolder(name, parentFolderToken) {
      const existing = (await list(parentFolderToken)).find(item => item.type === 'folder' && item.name === name);
      if (existing) return existing.token;
      const args = ['drive', '+create-folder', '--name', name, '--as', 'user', '--json'];
      if (parentFolderToken) args.push('--folder-token', parentFolderToken);
      const created = unwrap(await run(args));
      const token = created.folder_token || created.token;
      if (!token) throw new Error(`创建飞书文件夹后未返回 token: ${name}`);
      return token;
    },
    async findFile(name, folderToken) {
      return (await list(folderToken)).find(item => item.type === 'file' && item.name === name) || null;
    },
    async downloadJson(fileToken) {
      const temporary = await mkdtemp(join(tmpdir(), 'figma-task-download-'));
      const name = '_PRD_DEMO_ROOT.json';
      try {
        await run([
          'drive', '+download', '--file-token', fileToken, '--output', name,
          '--as', 'user', '--json'
        ], { cwd: temporary });
        return JSON.parse(await readFile(join(temporary, name), 'utf8'));
      } finally {
        await rm(temporary, { recursive: true, force: true });
      }
    },
    async uploadBytes(name, bytes, folderToken) {
      const temporary = await mkdtemp(join(tmpdir(), 'figma-task-upload-'));
      try {
        await writeFile(join(temporary, name), bytes);
        const args = ['drive', '+upload', '--file', name, '--name', name, '--folder-token', folderToken, '--as', 'user', '--json'];
        return unwrap(await run(args, { cwd: temporary }));
      } finally {
        await rm(temporary, { recursive: true, force: true });
      }
    }
  };
}

module.exports = { unwrap, createLarkCliAdapter };
