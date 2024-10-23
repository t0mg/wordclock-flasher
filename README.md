# Wordclock Flasher

A Serial Flasher utility for the [Wordclock project](https://github.com/t0mg/wordclock), built with [esptool-js](https://github.com/espressif/esptool-js).

The sole purpose of this tool is to provide a simple, no-install tool to flash a Wordclock over USB (subsequent flashes can then be handled wirelessly via [OTA update](https://github.com/t0mg/wordclock/tree/main/software#ota-update)).

This project is based on a fork of the [esptool typescript example](https://github.com/espressif/esptool-js/tree/main/examples/typescript) that has been trimmed down to fit the specifics of the Wordclock project.

## Usage

- Head over to the public website of this tool using Chrome, Edge or another [Web Serial compatible browser](https://caniuse.com/web-serial).
- Press the Connect button, a dialog appears
- Connect your wordclock to your computer over USB and a new entry should show up in the dialog. Select that and confirm.
- The interface should identify your clock based on the chip it uses ([original DIY project](https://github.com/t0mg/wordclock/blob/main/README.md#hardware), or Nodo kit from [nodo-shop.nl](https://www.nodo-shop.nl/en/52-wordclock)) and display a list of available firmware files
- Click FLASH

### Advanced mode

By checking Advanced mode you'll reveal a few more options as well as full serial console that you can use separately. This is useful to check the serial debug messages if you are using a debug firmware.

## Developent

Same as the original [esptool typescript example](https://github.com/espressif/esptool-js/tree/main/examples/typescript):

### Testing it locally

```
npm install
npm run dev
```

Then open http://localhost:1234 in Chrome or Edge. The `npm run dev` step will call Parcel which start a local http server serving `index.html` with compiled `index.ts`.

### Generate build to publish

```
npm install
npm run build
```