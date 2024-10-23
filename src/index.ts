const connectButton = document.getElementById("connectButton") as HTMLButtonElement;
const traceButton = document.getElementById("copyTraceButton") as HTMLButtonElement;
const disconnectButton = document.getElementById("disconnectButton") as HTMLButtonElement;
const resetButton = document.getElementById("resetButton") as HTMLButtonElement;
const consoleStartButton = document.getElementById("consoleStartButton") as HTMLButtonElement;
const consoleStopButton = document.getElementById("consoleStopButton") as HTMLButtonElement;
const eraseButton = document.getElementById("eraseButton") as HTMLButtonElement;
const programButton = document.getElementById("programButton");
const terminal = document.getElementById("terminal");
const programDiv = document.getElementById("program");
const consoleDiv = document.getElementById("console");
const lblConnTo = document.getElementById("lblConnTo");

const progressBar = document.getElementById("progressBar") as HTMLInputElement;
const fileSelect = document.getElementById("fileSelect");
const flashDiv = document.getElementById("flash");
const advanced = document.getElementById("advanced") as HTMLInputElement;

// https://unpkg.com/esptool-js@0.4.6/bundle.js
import { ESPLoader, FlashOptions, LoaderOptions, Transport } from "../lib/bundle.js";
import { serial } from "web-serial-polyfill";
if (!navigator.serial && navigator.usb) navigator.serial = serial;

declare let Terminal; // Terminal is imported in HTML script
declare let CryptoJS; // CryptoJS is imported in HTML script

const term = new Terminal({ cols: 60, rows: 20 });
term.open(terminal);

let device = null;
let transport: Transport;
let chip: string = null;
let esploader: ESPLoader;

const espLoaderTerminal = {
  clean() {
    term.clear();
  },
  writeLine(data) {
    term.writeln(data);
  },
  write(data) {
    term.write(data);
  },
};

enum WordclockType {
  UNKNOWN = 1,
  OG,
  NODO,
}

function getWordclockType(chipString) {
  if (chipString == null) {
    return WordclockType.UNKNOWN;
  }
  if (chipString.startsWith("ESP32-C3")) {
    return WordclockType.NODO;
  }
  if (chipString.startsWith("ESP32")) {
    return WordclockType.OG;
  }
  return WordclockType.UNKNOWN;
}

connectButton.onclick = async () => {
  if (device === null) {
    device = await navigator.serial.requestPort({});
    transport = new Transport(device, true);
  }

  try {
    const flashOptions = {
      transport,
      baudrate: 921600, //parseInt(baudrates.value),
      terminal: espLoaderTerminal,
    } as LoaderOptions;
    esploader = new ESPLoader(flashOptions);

    chip = await esploader.main();

  } catch (e) {
    console.error(e);
    term.writeln(`Error: ${e.message}`);
    if (!advanced.checked) {
      alert(e.message + '\n\nPlease reload this page.');
    }
  }

  if (chip == null) {
    return;
  }

  fetchFileList('firmwares.json')
    .then(fileList => {
      createFileSelector(fileList);
    })
    .catch(error => {
      console.error(error);
    });

  console.log("Settings done for :" + chip);
  lblConnTo.innerHTML = "Connected to device: " + (getWordclockType(chip) == WordclockType.NODO ? "nodo " : "") + "Wordclock " + chip;
  lblConnTo.style.display = "block";
  connectButton.style.display = "none";
  consoleStartButton.style.display = "none";
  disconnectButton.style.display = "initial";
  traceButton.removeAttribute("disabled");
  eraseButton.removeAttribute("disabled");
  consoleDiv.style.display = "none";

  flashDiv.style.display = "initial";
};

traceButton.onclick = async () => {
  if (transport) {
    transport.returnTrace();
  }
};

resetButton.onclick = async () => {
  if (transport) {
    await transport.setDTR(false);
    await new Promise((resolve) => setTimeout(resolve, 100));
    await transport.setDTR(true);
  }
};

eraseButton.onclick = async () => {
  eraseButton.disabled = true;
  try {
    await esploader.eraseFlash();
  } catch (e) {
    console.error(e);
    term.writeln(`Error: ${e.message}`);
    if (!advanced.checked) {
      alert(e.message + '\n\nPlease reload this page.');
    }
  } finally {
    eraseButton.disabled = false;
  }
};


/**
 * Clean devices variables on chip disconnect. Remove stale references if any.
 */
function cleanUp() {
  device = null;
  transport = null;
  chip = null;
}

disconnectButton.onclick = async () => {
  disconnect();
};

async function disconnect() {
  if (transport) await transport.disconnect();

  term.reset();
  connectButton.style.display = "initial";
  disconnectButton.style.display = "none";
  traceButton.setAttribute("disabled", "disabled");
  eraseButton.setAttribute("disabled", "disabled");
  lblConnTo.style.display = "none";
  consoleStartButton.style.display = "initial";
  consoleDiv.style.display = "initial";

  flashDiv.style.display = "none";
  progressBar.value = '0';
  cleanUp();
}

let isConsoleClosed = false;
consoleStartButton.onclick = async () => {
  if (device === null) {
    device = await navigator.serial.requestPort({});
    transport = new Transport(device, true);
  }
  // lblConsoleFor.style.display = "block";
  consoleStartButton.style.display = "none";
  consoleStopButton.style.display = "initial";
  resetButton.style.display = "initial";
  programDiv.style.display = "none";

  await transport.connect(115200); //parseInt(consoleBaudrates.value));
  isConsoleClosed = false;

  while (true && !isConsoleClosed) {
    const val = await transport.rawRead();
    if (typeof val !== "undefined") {
      term.write(val);
    } else {
      break;
    }
  }
  console.log("quitting console");
};

consoleStopButton.onclick = async () => {
  isConsoleClosed = true;
  if (transport) {
    await transport.disconnect();
    await transport.waitForUnlock(1500);
  }
  term.reset();
  consoleStartButton.style.display = "initial";
  consoleStopButton.style.display = "none";
  resetButton.style.display = "none";
  programDiv.style.display = "initial";
  cleanUp();
};

let fileData;

programButton.onclick = async () => {
  programButton.setAttribute("disabled", "disabled");

  const select = document.querySelector("#fileSelect select") as HTMLSelectElement;
  const selectedFileUrl = select.value;

  let err: string;

  await readFileAsByteString(selectedFileUrl)
    .then(file => {
      fileData = file;
      if (!fileData) {
        err = "File empty";
      }
    })
    .catch(error => {
      err = error.message;
      console.error(error);
    });

  if (err) {
    alert(err);
    return;
  }

  const fileArray = [{ data: fileData, address: 0 }];

  try {
    const flashOptions: FlashOptions = {
      fileArray: fileArray,
      flashSize: "keep",
      eraseAll: false,
      compress: true,
      reportProgress: (_, written, total) => {
        progressBar.value = `${(written / total) * 100}`;
      },
      calculateMD5Hash: (image) => CryptoJS.MD5(CryptoJS.enc.Latin1.parse(image)),
    } as FlashOptions;
    await esploader.writeFlash(flashOptions);
    disconnect();
    alert("Flashing successful, disconnecting.");
  } catch (e) {
    console.error(e);
    term.writeln(`Error: ${e.message}`);
    if (!advanced.checked) {
      alert('Flashing failed.\n\n' + e.message);
    }
  } finally {
    programButton.removeAttribute("disabled");
  }
};

function readFileAsByteString(fileUrl) {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('GET', fileUrl, true);
    xhr.responseType = 'arraybuffer';
    xhr.onload = function () {
      if (xhr.status === 200) {
        const arrayBuffer = xhr.response;
        const byteArray = new Uint8Array(arrayBuffer);
        let byteString = '';
        for (let i = 0; i < byteArray.length; i++) {
          byteString += String.fromCharCode(byteArray[i]);
        }
        resolve(byteString);
      } else {
        reject(new Error(`Failed to fetch file: ${fileUrl}`));
      }
    };
    xhr.onerror = reject;
    xhr.send();
  });
}

function fetchFileList(jsonUrl) {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('GET', jsonUrl, true);
    xhr.onload = function () {
      if (xhr.status === 200) {
        const fileList = JSON.parse(xhr.responseText);
        resolve(fileList);
      } else {
        reject(new Error(`Failed to fetch file list: ${jsonUrl}`));
      }
    };
    xhr.onerror = reject;
    xhr.send();
  });
}

function createFileSelector(fileList) {
  fileSelect.childNodes.forEach((n) => fileSelect.removeChild(n));
  const select = document.createElement('select');
  select.id = "select";
  fileList.forEach((file: { url: string; label: string; chip: string; }) => {
    if (getWordclockType(chip) == getWordclockType(file.chip)) {
      const option = document.createElement('option');
      option.value = file.url;
      option.textContent = file.label;
      select.appendChild(option);
    }
  });
  fileSelect.appendChild(select);
  return select;
}

advanced.addEventListener("change", (e) => {
  document.body.classList.toggle("advancedMode", (e.target as HTMLInputElement).checked);
})