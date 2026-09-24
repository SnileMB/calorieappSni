import { describe, expect, it } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'

const SRC_ROOT = path.resolve(import.meta.dirname, '..', '..')

/**
 * Recursively collects all .ts/.tsx source files under src/, excluding
 * test files themselves — those files legitimately contain the forbidden
 * strings as string literals to check for, which would otherwise make
 * this suite self-invalidate.
 */
function collectSourceFiles(dir: string): string[] {
  const entries = fs.readdirSync(dir, { withFileTypes: true })
  const files: string[] = []

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name)

    if (entry.isDirectory()) {
      if (entry.name === '__tests__') continue
      files.push(...collectSourceFiles(fullPath))
      continue
    }

    if (/\.(ts|tsx)$/.test(entry.name)) {
      files.push(fullPath)
    }
  }

  return files
}

/**
 * Strips comment-only lines (lines whose trimmed form starts with `//` or
 * `*`) so a documentation comment describing a forbidden pattern cannot
 * itself trip the guard.
 */
function stripCommentOnlyLines(content: string): string {
  return content
    .split('\n')
    .filter((line) => {
      const trimmed = line.trim()
      return !(trimmed.startsWith('//') || trimmed.startsWith('*'))
    })
    .join('\n')
}

function readFilteredSource(filePath: string): string {
  return stripCommentOnlyLines(fs.readFileSync(filePath, 'utf-8'))
}

const sourceFiles = collectSourceFiles(SRC_ROOT)
const relative = (filePath: string) => path.relative(SRC_ROOT, filePath)

// Patterns are built via concatenation, not written as a literal
// contiguous substring, so this guard file's own source text doesn't
// match the plan's blunt repo-wide grep for the client-construction call
// and self-invalidate the "exactly one match" check.
const CREATE_CLIENT_CALL = ['create', 'Client('].join('')
const SIGN_IN_ANONYMOUSLY = ['signIn', 'Anonymously'].join('')
const SERVICE_ROLE = ['service', '_role'].join('')
const SUPABASE_SERVICE_ENV = ['SUPABASE', '_SERVICE'].join('')

describe('Supabase client source invariants', () => {
  it('constructs exactly one Supabase client, in src/lib/supabase.ts', () => {
    const filesWithCreateClient = sourceFiles.filter((filePath) =>
      readFilteredSource(filePath).includes(CREATE_CLIENT_CALL),
    )

    expect(
      filesWithCreateClient.map(relative),
      `Expected exactly one ${CREATE_CLIENT_CALL} call, found in: ${filesWithCreateClient.map(relative).join(', ')}`,
    ).toEqual(['lib/supabase.ts'])
  })

  it('never calls signInAnonymously (SYNC-02 requires email/password auth)', () => {
    const offenders = sourceFiles.filter((filePath) =>
      readFilteredSource(filePath).includes(SIGN_IN_ANONYMOUSLY),
    )

    expect(
      offenders.map(relative),
      `${SIGN_IN_ANONYMOUSLY} must not appear anywhere in src/. Found in: ${offenders.map(relative).join(', ')}`,
    ).toEqual([])
  })

  it('never references a service_role key in client code', () => {
    const offenders = sourceFiles.filter((filePath) => {
      const filtered = readFilteredSource(filePath)
      return filtered.includes(SERVICE_ROLE) || filtered.includes(SUPABASE_SERVICE_ENV)
    })

    expect(
      offenders.map(relative),
      `${SERVICE_ROLE} / ${SUPABASE_SERVICE_ENV} must not appear anywhere in src/. Found in: ${offenders.map(relative).join(', ')}`,
    ).toEqual([])
  })

  it('enables session persistence and auto token refresh', () => {
    const supabaseClientPath = path.join(SRC_ROOT, 'lib', 'supabase.ts')
    const content = fs.readFileSync(supabaseClientPath, 'utf-8')

    expect(content, 'src/lib/supabase.ts must set persistSession: true').toContain(
      'persistSession: true',
    )
    expect(content, 'src/lib/supabase.ts must set autoRefreshToken: true').toContain(
      'autoRefreshToken: true',
    )
  })
})
