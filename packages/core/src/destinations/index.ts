import type { DestinationProvider } from '../interfaces';
import { AgentsMdProvider } from './agents-md-provider';
import { ClaudeCodeProvider } from './claude-code-provider';
import { CopilotProvider } from './copilot-provider';
import { CursorProvider } from './cursor-provider';
import { WindsurfProvider } from './windsurf-provider';

// Create singleton instances
export const cursorProvider = new CursorProvider();
export const windsurfProvider = new WindsurfProvider();
export const claudeCodeProvider = new ClaudeCodeProvider();
export const agentsMdProvider = new AgentsMdProvider();
export const copilotProvider = new CopilotProvider();

// Export as a map for easy lookup
export const destinations: ReadonlyMap<string, DestinationProvider> = new Map([
  ['cursor', cursorProvider],
  ['windsurf', windsurfProvider],
  ['claude-code', claudeCodeProvider],
  ['agents-md', agentsMdProvider],
  ['copilot', copilotProvider],
]);

// Intentionally do not re-export provider classes here to avoid barrel-file lint warnings.
