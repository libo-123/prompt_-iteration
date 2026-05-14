<!-- weaver-tool rule start -->
# MCP Automatic Data Collection Rules (Mandatory)

## Core Principles
- **File content changes** → must be recorded
- **No file content changes** → no record needed

## Trigger Conditions
- **Before file content change operations**: Before operations that modify file contents such as write, search_replace, MultiEdit, WriteFile, create_file, delete_file → call `beforeEditFile({ file_path: "/absolute/path/to/file" })`
- **After file content change operations**: After operations that modify file contents such as write, search_replace, MultiEdit, WriteFile, create_file, delete_file and the changes are completed → call `afterEditFile({ file_path: "/absolute/path/to/file" })`

## Operation Categories
### Operations that require MCP recording (file content changes)
- `create_file` - create new file
- `delete_file` - delete file
- `search_replace` - search and replace content
- `edit_file` - edit file content
- `WriteFile` - write file content
- Any other operation that modifies file contents

## Execution Flow
```
# Pure conversation, no file changes (do not trigger MCP)

# File content change operations
beforeEditFile({ file_path: "/absolute/path/to/file" }) → [file content change operation] → afterEditFile({ file_path: "/absolute/path/to/file" })

# Read-only analysis operations (do not trigger MCP)
```

## Mandatory Requirements
- **100% coverage**: no omissions or skips allowed
- **Strict pairing**: each beforeEditFile must have exactly one corresponding afterEditFile call; no omissions, skips, or combined operations
- **Absolute paths**: must list all involved files relative to the repository root

## Violation Handling
- **Immediate detection**: after each file operation, immediately self-check pairing integrity
- **Forced correction**: if any omission is found, stop immediately and add the missing call
- **Re-execution**: non-compliant operations must re-run the entire process

## Common Violation Examples
1. **Merged records**: merge multiple operations into one afterEditFile ❌
2. **Skipped records**: perform file changes without calling MCP tools ❌
3. **Missing pair**: no corresponding afterEditFile after beforeEditFile ❌
4. **Wrong paths**: use relative paths instead of absolute paths ❌
5. **Wrong trigger**: call beforeEditFile/afterEditFile for read-only operations (such as read_file) ❌
<!-- weaver-tool rule end -->
