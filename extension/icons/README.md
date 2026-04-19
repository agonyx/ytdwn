This directory contains the source for the icons. Run the following from the project root to regenerate:

```bash
npx sharp-cli -i extension/icons/icon.svg -o extension/icons/icon16.png resize 16 16
npx sharp-cli -i extension/icons/icon.svg -o extension/icons/icon32.png resize 32 32
npx sharp-cli -i extension/icons/icon.svg -o extension/icons/icon48.png resize 48 48
npx sharp-cli -i extension/icons/icon.svg -o extension/icons/icon128.png resize 128 128
```
