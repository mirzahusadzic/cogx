import { Command } from 'commander';
import { generateCommand } from './overlay/generate.js';
import { listCommand } from './overlay/list.js';

/**
 * Command for managing and generating analytical overlays.
 */
const overlayCommand = new Command('overlay').description(
  'Manage and generate analytical overlays.'
);

overlayCommand.addCommand(generateCommand);
overlayCommand.addCommand(listCommand);

export { overlayCommand };
