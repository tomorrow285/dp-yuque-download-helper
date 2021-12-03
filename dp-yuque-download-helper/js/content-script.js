let errorLog = [];
let pluginDomController = null;
let pluginLog = {
  flat: 1,
};

// document.addEventListener("DOMContentLoaded", function () {
//   const [isHitYuque, title] = isRepository();
//   console.log(isHitYuque, title);
//   if (!isHitYuque) return;
//   setTimeout(async () => {
//     // startDownload()
//   }, 3000);
// });

window.addEventListener("load", () => {
  const [isHitYuque, title] = isRepository();
  console.log("load", isHitYuque, title);
  if (!isHitYuque) return;

  appendDom();
});

async function startDownload() {
  pluginDomController.appendInfo("正在准备下载");
  errorLog = [];
  flatPage();
  const tree = findDocTree();
  pluginDomController.appendInfo(`开始下载文件`);
  await downloadTree(tree);
  pluginDomController.appendInfo(`全部文件下载完毕`);
  if (errorLog.length) {
    pluginDomController.appendInfo(`共${errorLog.length}个文件下载失败`);
  }
  pluginDomController.appendInfo(`开始打包文件`);
  const zip = bundleTree(tree);
  pluginDomController.appendInfo(`文件打包完毕，执行最终的下载！`);
  downloadZip(zip);
}

function flatPage() {
  const closeList = document.querySelectorAll(
    ".ant-tree-treenode-switcher-close"
  );
  if (!closeList.length) return;

  pluginDomController.appendInfo(
    `正在展开折叠项 第${pluginLog.flat++}次展开 共${
      closeList.length
    }项内容需要展开`
  );
  closeList.forEach((parent) => {
    if (!parent) return;
    const dom = parent.querySelector(".ant-tree-node-content-wrapper");
    if (!dom) return;
    dom.click();
  });

  flatPage();
}

function findDocTree() {
  const docList = document
    .querySelector(".ant-tree-list")
    .querySelectorAll(".ant-tree-treenode");
  const tree = [];
  const prevDomList = [];

  pluginDomController.appendInfo(
    `正在构建下载树 共发现${docList.length}个节点`
  );
  docList.forEach((dom, index) => {
    const reg = /catalog-treenode-level-(\d+)/;
    const level = dom.className.match(reg)[1] - 1;
    const parent = dom.querySelector(".name");
    const target = parent.querySelector("a");
    const item = {
      index,
      children: [],
    };
    if (target) {
      item.name = target.innerText;
      item.path = target.href;
    } else {
      item.name = parent.innerText;
    }
    if (level === 0) {
      tree.push(item);
    } else {
      prevDomList[level - 1].children.push(item);
    }
    prevDomList[level] = item;
  });

  return tree;
}

async function downloadTree(tree) {
  if (!tree.length) return;
  const promiseList = [];
  for (let i = 0; i < tree.length; i++) {
    const item = tree[i];
    await downloadTree(item.children);
    const downloadTail =
      "/markdown?attachment=true&latexcode=true&anchor=false&linebreak=false";
    const downloadPromise = downloadFile(item.path + downloadTail, item.name);
    promiseList.push(downloadPromise);
  }

  const blobList = await Promise.all(promiseList);

  blobList.forEach((blob, i) => {
    tree[i].blob = blob;
  });
}

async function downloadFile(url, name) {
  const res = await fetch(url);
  pluginDomController.appendInfo(`正在下载: ${name}.md`);
  if (res.status !== 200) {
    // console.error(`${name}.md下载失败，请手动下载`);
    pluginDomController.appendInfo(`${name}.md 下载失败，请手动下载`, true);
    errorLog.push(`download err:   ${name}.md`);
    return "error";
  }
  pluginDomController.appendInfo(`${name}.md 下载完成`);
  const blob = await res.blob();
  return blob;
}

function bundleTree(tree, zip = new JSZip()) {
  tree.forEach((item) => {
    zip.file(`${item.name}.md`, item.blob);
    if (item.children.length) {
      const subZip = zip.folder(item.name);
      bundleTree(item.children, subZip);
    }
  });
  return zip;
}

function downloadZip(zip) {
  const pageTitle = document.querySelector("h1").innerText;
  if (errorLog.length) {
    zip.file(`errorLog.txt`, errorLog.join("\n"));
  }
  zip.generateAsync({ type: "blob" }).then(function (content) {
    saveAs(content, `${pageTitle}.zip`);
  });
}

function isRepository() {
  const h1 = document.querySelector("h1");

  const isRepository = h1 && !h1.id && !h1.className;
  return [isRepository, h1 ? h1.innerText : ""];
}

function appendDom() {
  const oPluginDom = document.createElement("div");
  oPluginDom.className = "dp-yuque-plugin";

  const oTitDom = document.createElement("div");
  oTitDom.innerText = "DP语雀知识库文档批量下载小助手";
  oTitDom.className = "dp-yuque-tit";

  const oControllerDom = initControllerDom();

  oPluginDom.appendChild(oTitDom);
  oPluginDom.appendChild(oControllerDom);
  document.body.appendChild(oPluginDom);
}

function initControllerDom() {
  const oControllerDom = document.createElement("div");
  let isDownloadMode = true;
  let currentDom = null;
  pluginDomController = {
    _oReadyDom: null,
    _oInfoDom: null,
    getChildDom() {
      if (isDownloadMode) {
        if (this._oInfoDom) return this._oInfoDom;
        const oInfoDom = document.createElement("div");
        oInfoDom.className = "dp-yuque-info";
        this._oInfoDom = oInfoDom;
        return oInfoDom;
      } else {
        if (this._oReadyDom) return this._oReadyDom;
        const oReadyDom = document.createElement("div");
        const oButtonDom = document.createElement("div");
        oButtonDom.innerText = "开始下载";
        oButtonDom.className = "dp-yuque-download";
        oButtonDom.addEventListener("click", () => {
          console.log("addEventListener-click");
          this.switchDom();
          startDownload();
        });

        oReadyDom.appendChild(oButtonDom);
        this._oReadyDom = oReadyDom;
        return this._oReadyDom;
      }
    },
    switchDom() {
      isDownloadMode = !isDownloadMode;
      if (currentDom) {
        oControllerDom.removeChild(currentDom);
      }
      currentDom = this.getChildDom();
      oControllerDom.appendChild(currentDom);
    },
    appendInfo(text, err) {
      const oTextDom = document.createElement("div");
      oTextDom.innerText = text;
      oTextDom.className = "dp-yuque-text";
      if (err) {
        oTextDom.classList.add("error");
      }

      this._oInfoDom.appendChild(oTextDom);
      this._oInfoDom.scrollTop = this._oInfoDom.offsetHeight;
    },
  };

  pluginDomController.switchDom();
  return oControllerDom;
}
