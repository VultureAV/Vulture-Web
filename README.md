<p align="center">
  <img 
    src="https://github.com/VultureAV/Vulture-Web/blob/main/icons/VultureWeb-Text.png?raw=true"
    height="64"
    style="vertical-align: middle;"
  />
<p>A Firefox web extension that spoofs and masks your user data to enhance privacy and prevent tracking</p>
[![buymeacoffe](https://img.shields.io/badge/Buy%20Me%20A%20Coffee-FFDD00?logo=buymeacoffee&logoColor=black)](https://www.buymeacoffee.com/simpfey)
</p>

## Features

- **Screen Size Spoofing**: Randomize or customize your reported screen resolution
- **Referrer Masking**: Control and modify HTTP referrer headers
- **Language Spoofing**: Spoof accepted language headers to appear as different locales
- **Graphics Card Spoofing**: Mask your GPU information reported to websites
- **Tracking Prevention**: Disable common tracking mechanisms and telemetry

## Usage

Once installed, click the VultureWeb icon in your Firefox toolbar to:

- Toggle spoofing on/off
- Select language preferences
- Configure screen resolution
- Enable/disable tracking prevention

## How It Works

VultureWeb intercepts and modifies:

- **HTTP Headers**: Referrer, Accept-Language
- **Browser APIs**: `navigator.platform`, `screen.width`, `screen.height`, `navigator.language`
- **WebGL**: GPU renderer information
- **Canvas**: Fingerprinting protection
- **Storage**: Tracking cookie limitations

## Privacy Policy

VultureWeb does not collect, store, or transmit any user data. All spoofing occurs locally within your browser.

## Support

For issues or feature requests, please open an issue on the project repository.