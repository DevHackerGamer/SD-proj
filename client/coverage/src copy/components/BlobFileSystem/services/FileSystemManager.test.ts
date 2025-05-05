import { describe, it, expect, vi, beforeEach } from 'vitest';
import { FileSystemManager } from './FileSystemManager';
import * as fsModule from './FileSystemService';

// Mock the service module
vi.mock('./FileSystemService', () => ({
  fileSystemService: {
    listFiles: vi.fn(),
    ensureDirectoryStructure: vi.fn(),
  }
}));

describe('FileSystemManager', () => {
  let manager: FileSystemManager;

  beforeEach(() => {
    manager = new FileSystemManager();
    vi.clearAllMocks();
  });

  it('loadFiles should call fileSystemService.listFiles and return the files', async () => {
    const fakeFiles = [{ name: 'a.txt' }, { name: 'b.txt' }];
    (fsModule.fileSystemService.listFiles as ReturnType<typeof vi.fn>)
      .mockResolvedValue(fakeFiles);

    const result = await manager.loadFiles('/some/dir');

    expect(fsModule.fileSystemService.listFiles).toHaveBeenCalledWith('/some/dir');
    expect(result).toEqual(fakeFiles);
  });

  it('createDirectory should call ensureDirectoryStructure and return the full FSItem', async () => {
    // ✏️ Mock the *entire* FSItem shape your code returns:
    const fakeItem = {
      id: '/parent/newFolder',
      isDirectory: true,
      name: 'newFolder',
      parentPath: '/parent',
      path: '/parent/newFolder',
    };

    (fsModule.fileSystemService.ensureDirectoryStructure as ReturnType<typeof vi.fn>)
      .mockResolvedValue(fakeItem);

    const result = await manager.createDirectory('newFolder', '/parent');

    // it should call with the combined path
    expect(fsModule.fileSystemService.ensureDirectoryStructure)
      .toHaveBeenCalledWith('/parent/newFolder');

    // and return that full object
    expect(result).toEqual(fakeItem);
  });
});
