import type { DestinationPlugin } from '../interfaces';
import { AgentsMdPlugin } from './agents-md-plugin';
import { ClaudeCodePlugin } from './claude-code-plugin';
import { CopilotPlugin } from './copilot-plugin';
import { CursorPlugin } from './cursor-plugin';
import { WindsurfPlugin } from './windsurf-plugin';

// Create singleton instances
export const cursorPlugin = new CursorPlugin();
export const windsurfPlugin = new WindsurfPlugin();
export const claudeCodePlugin = new ClaudeCodePlugin();
export const agentsMdPlugin = new AgentsMdPlugin();
export const copilotPlugin = new CopilotPlugin();

// Export as a map for easy lookup
export const destinations: ReadonlyMap<string, DestinationPlugin> = new Map([
  ['cursor', cursorPlugin],
  ['windsurf', windsurfPlugin],
  ['claude-code', claudeCodePlugin],
  ['agents-md', agentsMdPlugin],
  ['copilot', copilotPlugin],
]);

// Intentionally do not re-export plugin classes here to avoid barrel-file lint warnings.
