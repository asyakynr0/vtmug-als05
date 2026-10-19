
const singleModeButton = document.getElementById("singleMode");
const basketModeButton = document.getElementById("basketMode");
const barcodeForm = document.getElementById("barcodeForm");
const barcodeInput = document.getElementById("barcode");
const result = document.getElementById("result");
const basketSection = document.getElementById("basket");
const basketItems = document.getElementById("basketItems");
const totalElement = document.getElementById("total");
const message = document.getElementById("message");
const camera = document.getElementById("camera");
const cameraButton = document.getElementById("startCamera");
const clearBasketButton = document.getElementById("clearBasket");

let products = [];
let mode = "single";
let basket = new Map();

let detector = null;
let cameraStream = null;
let scanning = false;
let scanTimer = null;
let lastBarcode = "";
let lastScanTime = 0;

// Fiyatları Türk lirası biçiminde gösterir.
function formatPrice(price) {
  return new Intl.NumberFormat("tr-TR", {
    style: "currency",
    currency: "TRY"
  }).format(price);
}

// JSON dosyasındaki ürünleri yükler.
async function loadProducts() {
  try {
    const response = await fetch("./products.json");

    if (!response.ok) {
      throw new Error("Ürün dosyası yüklenemedi.");
    }

    products = await response.json();
    message.textContent = "Ürünler yüklendi. Barkod okutabilirsin.";
  } catch (error) {
    message.textContent =
      "Ürünler yüklenemedi. Uygulamayı bir yerel sunucu üzerinden aç.";
    console.error(error);
  }
}

// HTML içine güvenli metin yerleştirmek için.
function safeText(value) {
  const element = document.createElement("span");
  element.textContent = String(value);
  return element.innerHTML;
}

// Tekli sorgu ve sepet modları arasında geçiş yapar.
function setMode(newMode) {
  mode = newMode;

  singleModeButton.classList.toggle(
    "active",
    mode === "single"
  );

  basketModeButton.classList.toggle(
    "active",
    mode === "basket"
  );

  basketSection.hidden = mode !== "basket";
  result.hidden = mode !== "single";

  singleModeButton.setAttribute(
    "aria-pressed",
    String(mode === "single")
  );

  basketModeButton.setAttribute(
    "aria-pressed",
    String(mode === "basket")
  );

  if (mode === "single") {
    result.innerHTML =
      "<h3>Ürün bilgisi</h3><p>Bir barkod sorgula.</p>";
  }
}

singleModeButton.addEventListener("click", () => {
  setMode("single");
});

basketModeButton.addEventListener("click", () => {
  setMode("basket");
});

// Barkod numarasına göre ürünü bulur.
function findProduct(barcode) {
  return products.find(
    product => product.barcode === barcode
  );
}

// Ürün bilgilerini ekranda gösterir.
function showProduct(product) {
  result.replaceChildren();

  const heading = document.createElement("h3");
  heading.textContent = "Ürün bilgisi";
  result.appendChild(heading);

  if (!product) {
    const errorText = document.createElement("p");
    errorText.textContent = "Ürün bulunamadı.";
    result.appendChild(errorText);
    message.textContent = "Ürün bulunamadı.";
    return;
  }

  const name = document.createElement("p");
  name.textContent = "Ürün: " + product.name;

  const brand = document.createElement("p");
  brand.textContent = "Marka: " + product.brand;

  const category = document.createElement("p");
  category.textContent = "Kategori: " + product.category;

  const quantity = document.createElement("p");
  quantity.textContent = "Miktar: " + product.quantity;

  const barcode = document.createElement("p");
  barcode.textContent = "Barkod: " + product.barcode;

  const price = document.createElement("span");
  price.className = "product-price";
  price.textContent = formatPrice(product.price);

  const addButton = document.createElement("button");
  addButton.className = "primary";
  addButton.textContent = "Sepete ekle";
  addButton.addEventListener("click", () => {
    addToBasket(product);
  });

  result.append(
    name,
    brand,
    category,
    quantity,
    barcode,
    price,
    document.createElement("br"),
    addButton
  );

  message.textContent = "Ürün bulundu.";
}

// Sepete ürün ekler ve miktarını artırır.
function addToBasket(product) {
  const current = basket.get(product.barcode);

  if (current) {
    current.quantity += 1;
  } else {
    basket.set(product.barcode, {
      product: product,
      quantity: 1
    });
  }

  renderBasket();
  message.textContent = product.name + " sepete eklendi.";
}

// Sepeti ve toplam fiyatı ekranda günceller.
function renderBasket() {
  basketItems.replaceChildren();

  let total = 0;

  if (basket.size === 0) {
    basketItems.textContent = "Henüz sepette ürün yok.";
  }

  for (const [barcode, item] of basket) {
    const row = document.createElement("div");
    row.className = "basket-row";

    const info = document.createElement("div");

    const name = document.createElement("strong");
    name.textContent = item.product.name;

    const detail = document.createElement("p");
    detail.textContent =
      formatPrice(item.product.price) +
      " × " + item.quantity;

    const subtotal = item.product.price * item.quantity;
    total += subtotal;

    const price = document.createElement("strong");
    price.textContent = formatPrice(subtotal);

    const minusButton = document.createElement("button");
    minusButton.textContent = "−";
    minusButton.setAttribute("aria-label", "Bir adet azalt");

    minusButton.addEventListener("click", () => {
      if (item.quantity > 1) {
        item.quantity -= 1;
      } else {
        basket.delete(barcode);
      }

      renderBasket();
    });

    info.append(name, detail, minusButton);
    row.append(info, price);
    basketItems.appendChild(row);
  }

  totalElement.textContent = formatPrice(total);
}

// Barkodu sorgular.
function processBarcode(rawBarcode) {
  const barcode = String(rawBarcode).trim();

  if (!barcode) return;

  const product = findProduct(barcode);

  if (mode === "single") {
    showProduct(product);
  } else {
    if (!product) {
      message.textContent = "Ürün bulunamadı.";
      return;
    }

    addToBasket(product);
  }
}

// Elle barkod girme işlemi.
barcodeForm.addEventListener("submit", event => {
  event.preventDefault();
  processBarcode(barcodeInput.value);
});

// Sepeti temizler.
clearBasketButton.addEventListener("click", () => {
  basket.clear();
  renderBasket();
  message.textContent = "Sepet temizlendi.";
});

// Kamerayı başlatır ve klasik barkodları okumaya hazırlanır.
async function startCamera() {
  if (!("BarcodeDetector" in window)) {
    message.textContent =
      "Bu tarayıcı barkod okuma API'sini desteklemiyor. Barkodu elle gir.";
    return;
  }

  if (!navigator.mediaDevices?.getUserMedia) {
    message.textContent =
      "Kamera kullanılamıyor. HTTPS veya localhost kullan.";
    return;
  }

  try {
    const formats = await BarcodeDetector.getSupportedFormats();

    const allowedFormats = [
      "ean_13",
      "ean_8",
      "upc_a",
      "upc_e",
      "code_128",
      "code_39",
      "itf"
    ];

    const supported = allowedFormats.filter(
      format => formats.includes(format)
    );

    if (supported.length === 0) {
      message.textContent =
        "Desteklenen klasik barkod formatı bulunamadı.";
      return;
    }

    detector = new BarcodeDetector({
      formats: supported
    });

    cameraStream = await navigator.mediaDevices.getUserMedia({
      audio: false,
      video: {
        facingMode: { ideal: "environment" }
      }
    });

    camera.srcObject = cameraStream;
    camera.hidden = false;

    await camera.play();

    scanning = true;
    cameraButton.textContent = "Kamerayı Durdur";
    message.textContent = "Barkodu kameraya göster.";

    scanLoop();
  } catch (error) {
    stopCamera();

    if (
      error.name === "NotAllowedError" ||
      error.name === "PermissionDeniedError"
    ) {
      message.textContent =
        "Kamera izni reddedildi. Tarayıcı ayarlarından izin ver veya barkodu elle gir.";
    } else {
      message.textContent =
        "Kamera başlatılamadı. HTTPS veya localhost kullanıp tekrar dene.";
    }
  }
}

// Kamera görüntüsünü cihazda tarar.
async function scanLoop() {
  if (!scanning) return;

  if (camera.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) {
    try {
      const codes = await detector.detect(camera);
      const now = Date.now();

      for (const code of codes) {
        const barcode = code.rawValue;

        // Aynı barkodu 1,5 saniye içinde tekrar işleme.
        if (
          barcode &&
          !(barcode === lastBarcode &&
            now - lastScanTime < 1500)
        ) {
          lastBarcode = barcode;
          lastScanTime = now;
          processBarcode(barcode);
          break;
        }
      }
    } catch (error) {
      // Bir kare okunamazsa sonraki kareyi dene.
    }
  }

  if (scanning) {
    scanTimer = setTimeout(scanLoop, 180);
  }
}

// Kamerayı güvenli şekilde durdurur.
function stopCamera() {
  scanning = false;

  if (scanTimer) {
    clearTimeout(scanTimer);
    scanTimer = null;
  }

  if (cameraStream) {
    cameraStream.getTracks().forEach(track => track.stop());
    cameraStream = null;
  }

  camera.srcObject = null;
  camera.hidden = true;
  cameraButton.textContent = "Kamerayı Başlat";
}

cameraButton.addEventListener("click", () => {
  if (scanning) {
    stopCamera();
    message.textContent = "Kamera durduruldu.";
  } else {
    startCamera();
  }
});

window.addEventListener("pagehide", stopCamera);

// Uygulama ilk açıldığında ürünleri yükle.
loadProducts();
renderBasket();

// PWA çevrimdışı altyapısını kaydet.
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    if (
      location.protocol === "https:" ||
      location.hostname === "localhost" ||
      location.hostname === "127.0.0.1"
    ) {
      navigator.serviceWorker
        .register("./service-worker.js")
        .catch(error => console.error(
          "Service Worker kaydedilemedi:", error
        ));
    }
  });
}
