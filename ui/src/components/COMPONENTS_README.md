# EC2EZ UI Components Documentation

This document provides an overview of the modular component architecture for the EC2EZ UI.

## Directory Structure

```
components/
├── common/               # Reusable utility components
│   ├── Section.jsx       # Collapsible section wrapper
│   ├── TreeNode.jsx      # Recursive tree node for metadata
│   └── ...
├── sections/            # Large section components
│   ├── IMDSTokenSection.jsx
│   ├── CredentialsSection.jsx
│   ├── AccountInfoSection.jsx
│   ├── MetadataTreeSection.jsx
│   ├── PermissionsSection.jsx
│   ├── S3Section.jsx
│   └── ResourceListSection.jsx  # Generic reusable section
├── modals/              # Modal dialog components
│   └── Modal.jsx
├── Terminal.jsx         # Real-time log terminal
├── Terminal.css
├── ResultsPanel.jsx     # Main results panel (refactored)
└── ResultsPanel.css
```

## Component Overview

### Common Components

#### Section.jsx
**Purpose:** Collapsible section wrapper with header and body.

**Props:**
- `title` (string) - Section title
- `badge` (ReactNode) - Optional badge to display in header
- `expanded` (boolean) - Whether the section is expanded
- `onToggle` (function) - Callback when section is toggled
- `children` (ReactNode) - Section content

**Example:**
```jsx
<Section
  title="My Section"
  badge={<span className="badge badge-info">5 items</span>}
  expanded={expandedSection === 'mySection'}
  onToggle={() => toggleSection('mySection')}
>
  <p>Section content goes here</p>
</Section>
```

#### TreeNode.jsx
**Purpose:** Recursive tree node for displaying IMDS metadata in a folder/file structure.

**Props:**
- `name` (string) - Node name
- `node` (object) - Node data with `type` (file/folder), `value`, `children`
- `path` (string) - Current path
- `onViewValue` (function) - Callback to view full value in modal

**Example:**
```jsx
<TreeNode
  name="metadata"
  node={treeData}
  path="/metadata"
  onViewValue={(path, value) => setModalData({ title: path, content: value })}
/>
```

### Modal Components

#### Modal.jsx
**Purpose:** Modal dialog for displaying content.

**Props:**
- `title` (string) - Modal title
- `content` (string) - Modal content (text/code)
- `onClose` (function) - Callback to close modal

**Example:**
```jsx
<Modal
  title="My Modal"
  content="Modal content here"
  onClose={() => setModalData(null)}
/>
```

### Section Components

#### IMDSTokenSection.jsx
**Purpose:** Displays the extracted IMDSv2 token with TTL information.

**Props:**
- `token` (string) - The IMDSv2 token
- `expanded` (boolean) - Section expansion state
- `onToggle` (function) - Toggle callback

#### CredentialsSection.jsx
**Purpose:** Displays extracted AWS credentials (Access Key, Secret Key, Session Token).

**Props:**
- `credentials` (object) - Credentials object with `roleName`, `accessKeyId`, `secretAccessKey`, `sessionToken`, `expiration`
- `expanded` (boolean) - Section expansion state
- `onToggle` (function) - Toggle callback

#### AccountInfoSection.jsx
**Purpose:** Displays AWS account information and discovered roles.

**Props:**
- `accountId` (string) - AWS account ID
- `region` (string) - AWS region
- `roles` (array) - List of discovered IAM roles
- `expanded` (boolean) - Section expansion state
- `onToggle` (function) - Toggle callback

#### MetadataTreeSection.jsx
**Purpose:** Displays IMDS metadata in a tree structure with folders and files.

**Props:**
- `metadataTree` (object) - Tree structure of metadata
- `metadataCount` (number) - Total count of metadata entries
- `expanded` (boolean) - Section expansion state
- `onToggle` (function) - Toggle callback
- `onViewValue` (function) - Callback to view full value in modal

#### PermissionsSection.jsx
**Purpose:** Displays discovered IAM permissions with dangerous permissions highlighted.

**Props:**
- `permissions` (object) - Permissions object with `allPermissions` and `dangerousPermissionsList`
- `expanded` (boolean) - Section expansion state
- `onToggle` (function) - Toggle callback

#### S3Section.jsx
**Purpose:** Displays S3 buckets with actions to list objects, download, and upload.

**Props:**
- `buckets` (array) - List of S3 buckets
- `loading` (boolean) - Loading state
- `expanded` (boolean) - Section expansion state
- `onToggle` (function) - Toggle callback
- `onListBuckets` (function) - Callback to list all buckets
- `onViewObjects` (function) - Callback to view objects in a bucket
- `onDownload` (function) - Callback to download an object
- `onUpload` (function) - Callback to upload an object

#### ResourceListSection.jsx
**Purpose:** A generic component for displaying lists of AWS resources (IAM users, roles, Lambda functions, etc.)

**Props:**
- `title` (string) - Section title
- `resources` (array) - List of resources to display
- `loading` (boolean) - Loading state
- `expanded` (boolean) - Section expansion state
- `onToggle` (function) - Toggle callback
- `badgeColor` (string) - Badge color class (e.g., 'info', 'warning', 'danger')
- `actions` (array) - Optional array of action buttons `{ label, onClick, className }`
- `renderItem` (function) - Optional custom render function for each item
- `onItemClick` (function) - Optional click handler for items

**Example:**
```jsx
<ResourceListSection
  title="IAM Users"
  resources={iamUsers}
  loading={loading.iamUsers}
  expanded={expandedSection === 'iamUsers'}
  onToggle={() => toggleSection('iamUsers')}
  badgeColor="info"
/>
```

**Example with custom rendering:**
```jsx
<ResourceListSection
  title="Lambda Functions"
  resources={lambdaFunctions}
  loading={loading.lambdaFunctions}
  expanded={expandedSection === 'lambda'}
  onToggle={() => toggleSection('lambda')}
  renderItem={(fn) => (
    <>
      <code>{fn}</code>
      <button className="btn-danger btn-link" onClick={() => invokeLambda(fn)}>
        Invoke
      </button>
    </>
  )}
/>
```

## Main Components

### ResultsPanel.jsx
**Purpose:** Main panel displaying all exploitation results and AWS resource information. Now refactored to use modular section components.

**Key Features:**
- Uses modular section components for cleaner code
- Auto-fetches resources when permissions are discovered
- Auto-expands metadata tree when available
- Proper proxy usage for external access (API_URL = '')

**Props:**
- `sessionData` (object) - Session data from exploitation flow
- `isRunning` (boolean) - Whether exploitation is currently running

## Adding New Resource Sections

To add a new AWS resource section (e.g., RDS instances, DynamoDB tables):

1. **Check if ResourceListSection can be reused**
   - If it's a simple list, use `ResourceListSection` with custom `renderItem` prop
   - If it needs complex UI, create a new section component

2. **Example: Adding RDS Instances**

```jsx
// In ResultsPanel.jsx

// Add to state
const [data, setData] = useState({
  // ... existing state
  rdsInstances: [],
});

// Add auto-fetch logic in useEffect
if (checkPerm('rds:DescribeDBInstances') && !fetchedData.has('rdsInstances')) {
  console.log('[AUTO-FETCH] RDS Instances');
  setFetchedData(prev => new Set([...prev, 'rdsInstances']));
  loadData('rdsInstances', '/api/rds/instances', 'instances');
}

// Add section to render
{hasPermission('rds:DescribeDBInstances') && (
  <ResourceListSection
    title="RDS Instances"
    resources={data.rdsInstances}
    loading={loading.rdsInstances}
    expanded={expandedSection === 'rds'}
    onToggle={() => toggleSection('rds')}
    renderItem={(instance) => (
      <code>{instance.DBInstanceIdentifier} - {instance.DBInstanceStatus}</code>
    )}
  />
)}
```

## Best Practices

1. **Component Size:** Keep components small and focused (< 200 lines)
2. **Reusability:** Use `ResourceListSection` for simple lists
3. **Props Documentation:** Always document props with JSDoc comments
4. **Naming:** Use descriptive names ending with "Section" for section components
5. **State Management:** Keep state in parent (ResultsPanel) and pass down as props
6. **API Calls:** Use relative URLs (API_URL = '') to work with Vite proxy

## File Size Comparison

**Before Refactoring:**
- `ResultsPanel.jsx`: ~737 lines (monolithic)

**After Refactoring:**
- `ResultsPanel.jsx`: ~450 lines (orchestrator)
- `Section.jsx`: ~26 lines
- `Modal.jsx`: ~26 lines
- `TreeNode.jsx`: ~67 lines
- `IMDSTokenSection.jsx`: ~37 lines
- `CredentialsSection.jsx`: ~53 lines
- `AccountInfoSection.jsx`: ~39 lines
- `MetadataTreeSection.jsx`: ~51 lines
- `PermissionsSection.jsx`: ~36 lines
- `S3Section.jsx`: ~67 lines
- `ResourceListSection.jsx`: ~91 lines

**Total:** ~493 lines across 11 files (vs 737 in one file)
**Benefit:** Much easier to maintain, test, and understand each component individually.

## Styling

All components use the same CSS file (`ResultsPanel.css`) for consistency. Classes follow BEM-like naming:
- `.result-section` - Section wrapper
- `.section-header` - Section header button
- `.section-body` - Section content
- `.resource-list` - List of resources
- `.modal-overlay` - Modal backdrop
- etc.

## Future Improvements

1. Add TypeScript for better type safety
2. Add unit tests for each component
3. Extract API calls to a separate service file
4. Add loading skeletons for better UX
5. Add error boundaries for resilience
6. Consider React Context for shared state
