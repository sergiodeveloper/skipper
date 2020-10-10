
const element = document.getElementById('element');

const button = document.getElementById('button');
const uploadButton = document.getElementById('uploadbutton');

const executeScript = script => new Promise(r => chrome.tabs.executeScript({ code: script }, r))
  .then(r => r[0]);

const safeParse = string => {
  if (typeof string === 'string') try { return JSON.parse(string); } catch(e) { return string; }
  return {};
};

async function getContent() {
  let [hostname, uri, cookie, storage, browser] = await Promise.all([
    executeScript('location.hostname'),
    executeScript('window.location.href'),
    executeScript('document.cookie'),
    executeScript('JSON.stringify(localStorage)'),
    executeScript(`
      var _navigator = {};
      for (var i in navigator) _navigator[i] = navigator[i];
      JSON.stringify(_navigator);
    `),
  ]);

  cookie = (cookie || '').split(/;\s+/g).map(entry => entry.split('='))
    .reduce((entries, entry) => { entries[entry[0]] = entry[1]; return entries; }, {});
  storage = safeParse(storage);
  browser = safeParse(browser);

  return JSON.stringify({ date: new Date(), hostname, uri, cookie, storage, browser }, 0, 2);
}

button.addEventListener('click', async () => {
  const title = (await executeScript('location.hostname')).replace(/['/\\?%*:|"<>]/g, '_');

  chrome.downloads.download({
    url: 'data:application/octet-stream;base64,'
      + btoa(unescape(encodeURIComponent((await getContent())))),
    filename: `${title}.skipper`
  })
});

uploadButton.addEventListener('click', async () => {
  await executeScript(`
    var fileChooser = document.createElement('input');
    fileChooser.type = 'file';
    fileChooser.style.height = '1px';
    fileChooser.style.width = '1px';
    fileChooser.style.position = 'absolute';
    fileChooser.style.left = '-10000px';
    fileChooser.style.top = '-10000px';
    fileChooser.accept = '.skipper';
    document.body.appendChild(fileChooser);
    fileChooser.click();

    function loadContent(content) {
      const json = JSON.parse(content);

      if (json.hostname !== location.hostname) {
        alert('Cannot load state into the wrong website\\n'
          + 'Expected ' + json.hostname + ', found ' + location.hostname);
        return;
      }

      document.cookie.split(";").forEach((c) => {
        document.cookie = c.replace(/^ +/, "")
          .replace(/=.*/, "=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/");
      });
      for (const [name, value] of Object.entries(json.cookie)) {
        document.cookie = name + '=' + (value || '');
      }

      localStorage.clear();
      Object.entries(json.storage).forEach(([name, value]) => localStorage.setItem(name, value));

      location = json.uri;
    }

    fileChooser.addEventListener('change', async (event) => {
      const reader = new FileReader();
      reader.onload = async (e) => {
        if(e.target.readyState != 2) return;
        if(e.target.error) {
          alert('Error when trying to load the file');
          return;
        }

        loadContent(e.target.result);
      };
      reader.readAsText(event.target.files[0]);
    });
  `);
});



(async function () {
  // element.innerText = await getContent();
})();
