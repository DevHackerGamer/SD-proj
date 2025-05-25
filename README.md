## Testing
👉 Find the code coverage in the CoverageDone branch actions workflow. 
### Test scope:
- FileListDisplay    Renders list of files or folders.
- FileListItem       Renders file or folder individually.
- FilePreviewModel   shows file preview.
- HomePage           Root component renders search bar.
- Icons              Renders icons file types.
- NavigationBar      Renders UI for going up or down directiories.
- NavigationHistory  Checks for navigation history logic.
- PropertiesModal    Display file metadata and info.
- SearchBar          File system search UI.

### Testing types:
- Unit test           Ensures that each component behaves and works properly induvidually.
- Intergration test   Unit test + mocks, we also simulted user interactions between componets to ensure that they can work well together.
- Mocked api          Since api qurries take long we have mocked it for testing we also have dummy data to mock api calls and behaviour.

### Testing tools:
- Jest, Jest Coverage.
- React testing library.

### Tessting Structure:

```
Root folder
...
├── babel.config.cjs
├── jest.config.cjs
├── client/
│   ├── src/
│   └── setupTest.ts    
│   └── _mocks_/
│   └── ... 
│   └── _tests_/
│   └── ...
...
```
Built with ❤️ using React Router.
