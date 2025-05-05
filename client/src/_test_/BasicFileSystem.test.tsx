import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import BasicFileSystem from '../components/filesystem/BasicFileSystem';
import { fileSystemService } from '../components/filesystem/FileSystemService';

jest.mock('../components/filesystem/FileSystemService', () => {
  const originalModule = jest.requireActual('../components/filesystem/FileSystemService');
  return {
    ...originalModule,
    fileSystemService: {
      ...originalModule.fileSystemService,
      createDirectory: jest.fn(),
      listFiles: jest.fn().mockResolvedValue([]),
    },
  };
});

describe('BasicFileSystem Component', () => {
  it('creates a new folder when button is clicked', async () => {
    window.prompt = jest.fn().mockReturnValue('/Test Folder');

    const createDirMock = fileSystemService.createDirectory as jest.Mock;
    createDirMock.mockResolvedValue({
      message: 'Folder created',
      path: '/Test Folder',
    });

    render(<BasicFileSystem />);

    const newFolderButton = screen.getByTitle('New Folder');
    await userEvent.click(newFolderButton);

    await waitFor(() => {
      expect(createDirMock).toHaveBeenCalledWith('/Test Folder');
    });
  });
});
