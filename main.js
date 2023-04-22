var stderr = "";
var Module = {
  // Hook to capture the stderr stream
  printErr: line => { stderr += line + '\n'; }
};

async function outguess(input_file, parameters) {
  // Clear stderr
  stderr = "";

  let image_filename = allocateUTF8(input_file.name);
  let image_data_size = input_file.size;
  let image_data_ptr = Module._malloc(image_data_size);
  let image_data = new Uint8Array(await input_file.arrayBuffer());
  for (let i = 0; i < image_data_size; i++)
    setValue(image_data_ptr + i, image_data[i], "i8");

  let key_ptr = allocateUTF8(parameters.key);
  let use_error_correction = parameters.error_correction ? 1 : 0;

  let return_info = null;
  try {
    // outguess_main(char* image_filename, uint8_t* image_data, size_t image_data_size)
    return_info = Module._outguess_main(image_filename, image_data_ptr, image_data_size, key_ptr, use_error_correction);
  }
  catch (e) {
    if (e.name == "ExitStatus") {
      // outguess just called "exit(1)". More information should be available on stderr,
      //  we can just return indicating a failure.

      // emscriptem will append a debug message to stderr, warning about this exit.
      // We make sure not to show this message.
      let info = stderr;
      info = info.substring(0, info.length - 1);
      info = info.substring(0, info.lastIndexOf("\n"));

      _free(image_filename);
      _free(image_data_ptr);
      _free(key_ptr);

      return {
        success: false,
        output: null,
        info: info
      };
    }
    else if (e.name == "RuntimeError") {
      return {
        success: false,
        output: null,
        info: `Outguess crashed: ${e.message}.\nThis crash would probably have also occured when using the original command-line version.`
      };
    }
    else {
      // Unknown error, log it
      console.warn(e);
    }
  }

  let message_ptr = getValue(return_info, "i8*");
  let message_length = getValue(return_info + 4, "i32");

  let message_outguessed = message_ptr !== 0;
  let message = null;

  if (message_outguessed) {
    message = new Uint8Array(message_length);
    for (let i = 0; i < message_length; i++)
      message[i] = getValue(message_ptr + i, "i8");
  }

  _free(image_filename);
  _free(image_data_ptr);
  _free(key_ptr);

  if (message_outguessed)
    _free(message_ptr);
  _free(return_info);

  return {
    success: message_outguessed,
    output: message,
    info: stderr
  };
}

// Detects whether a byte array can be interpreted as a string.
function is_printable(array) {
  try {
    let strict_decoder = new TextDecoder('utf8', {
      fatal: true
    });

    strict_decoder.decode(array);
    return true;
  } catch (e) {
    return false;
  }
}
function decode_array(array) {
  let decoder = new TextDecoder('utf8');
  return decoder.decode(array);
}

class JOutguess {
  constructor() {
    // DOM elements
    this.file_selector = null;
    this.run_button = null;
    this.download_button = null;
    this.output_textarea = null;

    // Parameters
    this.input_file = null;
    this.parameters = {
      key: "Default key",
      error_correction: false,
    };

     // Output
    this.output_blob = null;
  }

  initialize() {
    // DOM elements
    this.file_selector = document.getElementById("file-selector");
    this.run_button = document.getElementById("run-button");
    this.download_button = document.getElementById("download-button"); 
    this.output_textarea = document.getElementById("text-output");
    this.info_textarea = document.getElementById("info-output");
    this.key_input = document.getElementById("key");
    this.error_correction_checkbox = document.getElementById("error-correction");

    // Events
    this.file_selector.addEventListener("input", () => 
      this.process_input_files(this.file_selector.files)
    );
    document.body.addEventListener("drop", ev => {
      ev.preventDefault();

      let files = [];
      if (ev.dataTransfer.items)
        files = Array.from(ev.dataTransfer.items)
                  .filter(item => item.kind === "file")
                  .map(item => item.getAsFile());
      else
        files = ev.dataTransfer.files;

      this.process_input_files(files);
    });
    document.body.addEventListener("dragover", ev => ev.preventDefault());

    this.download_button.addEventListener("click", () =>
      this.download_output()
    );

    this.run_button.addEventListener("click", async () =>
      this.run_outguess()
    );

    this.key_input.addEventListener("change", () =>
      this.parameters.key = this.key_input.value === "" ? "Default key" : this.key_input.value
    );
    this.error_correction_checkbox.addEventListener("change", () =>
      this.parameters.error_correction = this.error_correction_checkbox.checked
    );

    // Initialization
    this.clear_output();
    this.process_input_files(this.file_selector.files);

    console.log("Initialized!");
  }

  process_input_files(files) {
    if (files.length == 0)
      return;

    if (files.length > 1) {
      alert("Only one image file can be selected.");
      return;
    }

    this.input_file = files[0];
    this.run_button.removeAttribute("disabled");
    this.clear_output();
  }
  async run_outguess() {
    if (this.input_file === null)
      return;

    let result = await outguess(this.input_file, this.parameters);

    this.set_info(result.info);

    if (result.success)
      this.set_output(result.output);
    else
      this.clear_output();
  }

  // Output
  clear_output() {
    this.output_textarea.setAttribute("disabled", "");
    this.output_textarea.textContent = "";
    this.download_button.setAttribute("disabled", "");

    this.output_blob = null;
  }
  set_output(output) {
    if (is_printable(output)) {
      this.output_textarea.removeAttribute("disabled");
      this.output_textarea.textContent = decode_array(output);
    }
    else {
      this.output_textarea.setAttribute("disabled", "");
      this.output_textarea.textContent = "Output isn't printable!";
    }

    this.download_button.removeAttribute("disabled");
    this.output_blob = new Blob([output]);
  }

  clear_info() {
    this.info_textarea.setAttribute("disable", "");
    this.info_textarea.textContent = "";
  }
  set_info(info) {
    this.info_textarea.removeAttribute("disabled");
    this.info_textarea.textContent = info;
  }

  download_output() {
    if (this.output_blob === null)
      return;

    let link = document.createElement("a");
    link.download = "output";
    link.href = URL.createObjectURL(this.output_blob);
    link.click();
    URL.revokeObjectURL(link.href);
  }
}


const joutguess = new JOutguess;
document.addEventListener("DOMContentLoaded", () => joutguess.initialize());
