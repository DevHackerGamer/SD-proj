TEST SCOPE:
a) FileListDisplay => renders list of files/folders
b) FileListItem => renders file/folder individually
c) FilePreviewModel => shows file preview
d) HomePage => root component renders search bar
e) Icons => Renders icons file types
f) NavigationBar => renders UI for going up/doen directiories
g) NavigationHistory => checks for navigation history logic
h) PropertiesModal => Display file metadata and info
i) SearchBar => file system search UI

TEST TYPES:
Unit test => enusred that each component behaves induvidually
Intergration test => unit test + mocks, we also simulted user interactions between componets
Mocked api => since api qurries take long we have mocked it for testing we also have dummy data to mock api calls

TOOLS:
Jest, Jest Coverage
React testing library

STRUCTURE:
a) find test files in _tests_
b) ensure babel.config.cjs is good to all typescripts testing
c) ensure jest.config.cjs is good to call you setupTest and to mock css styles
d) ensure setupTests.ts is good to get all you testing libraries
e) TEST are ran on branch CoverageDone

TARGET:
a) Statments 80
b) Branch 80 
c) Functions 80 
d) Lines 80
