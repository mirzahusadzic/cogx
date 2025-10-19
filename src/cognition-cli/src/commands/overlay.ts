import { Command } from 'commander';
import { generateCommand } from './overlay-commands/generate.js';

const overlayCommand = new Command('overlay').description(
  'Manage and generate analytical overlays.'
);

overlayCommand.addCommand(generateCommand);

export { overlayCommand };
