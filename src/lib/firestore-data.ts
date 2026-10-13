import {
  collection,
  doc,
  onSnapshot,
  orderBy,
  query,
  runTransaction,
  setDoc,
  writeBatch,
  type Unsubscribe,
} from "firebase/firestore";

import type { Client, Ficha, Loan, Product, Purchase, Sale } from "./data-model";
import { getFirebaseServices } from "./firebase";

type DataHandlers = {
  products: (value: Product[]) => void;
  clients: (value: Client[]) => void;
  sales: (value: Sale[]) => void;
  loans: (value: Loan[]) => void;
  fichas: (value: Ficha[]) => void;
  purchases: (value: Purchase[]) => void;
  error: (message: string) => void;
};

export async function subscribeAppData(handlers: DataHandlers) {
  const { db } = await getFirebaseServices();
  const subscriptions: Unsubscribe[] = [];
  const watch = <T>(name: string, callback: (value: T[]) => void, sorted = false) => {
    const source = sorted
      ? query(collection(db, name), orderBy("date", "desc"))
      : collection(db, name);
    subscriptions.push(
      onSnapshot(
        source,
        (snapshot) => callback(snapshot.docs.map((item) => item.data() as T)),
        (error) => handlers.error(error.message),
      ),
    );
  };
  watch<Product>("products_express", handlers.products);
  watch<Client>("clients_express", handlers.clients);
  watch<Sale>("sales_express", handlers.sales, true);
  watch<Loan>("loans_express", handlers.loans, true);
  watch<Ficha>("fichas_express", handlers.fichas, true);
  watch<Purchase>("purchases_express", handlers.purchases, true);
  return () => subscriptions.forEach((unsubscribe) => unsubscribe());
}

export async function saveClient(client: Client) {
  const { db } = await getFirebaseServices();
  await setDoc(doc(db, "clients_express", client.id), client);
}

export async function saveProduct(product: Product) {
  const { db } = await getFirebaseServices();
  await setDoc(doc(db, "products_express", product.code), product);
}

export async function saveSale(sale: Sale, clientName: string) {
  const { db } = await getFirebaseServices();
  await runTransaction(db, async (transaction) => {
    const lines = sale.items?.length
      ? sale.items
      : [{ productCode: sale.productCode, quantity: 1 }];
    const productRefs = lines.map((line) => doc(db, "products_express", line.productCode));
    const snapshots = await Promise.all(productRefs.map((reference) => transaction.get(reference)));
    snapshots.forEach((snapshot, index) => {
      const line = lines[index];
      if (!line) return;
      const stock = Number(snapshot.data()?.["stock"] ?? 0);
      if (!snapshot.exists() || stock < line.quantity)
        throw new Error(`${line.productCode} no tiene unidades suficientes.`);
    });
    const ficha: Ficha = {
      id: `sale_${sale.id}`,
      kind: "sale",
      sourceId: sale.id,
      recordId: sale.invoice,
      clientId: sale.clientId,
      clientName,
      date: sale.date,
      item: sale,
    };
    snapshots.forEach((snapshot, index) => {
      const line = lines[index];
      const reference = productRefs[index];
      if (line && reference)
        transaction.update(reference, {
          stock: Number(snapshot.data()?.["stock"] ?? 0) - line.quantity,
        });
    });
    transaction.set(doc(db, "sales_express", sale.id), sale);
    transaction.set(doc(db, "fichas_express", ficha.id), ficha);
    transaction.set(doc(db, "collections_express", ficha.id), {
      ...ficha,
      installments: sale.installments,
      financed: sale.financed,
    });
  });
}

export async function saveLoan(loan: Loan, clientName: string) {
  const { db } = await getFirebaseServices();
  const ficha: Ficha = {
    id: `loan_${loan.id}`,
    kind: "loan",
    sourceId: loan.id,
    recordId: loan.reference,
    clientId: loan.clientId,
    clientName,
    date: loan.date,
    item: loan,
  };
  const batch = writeBatch(db);
  batch.set(doc(db, "loans_express", loan.id), loan);
  batch.set(doc(db, "fichas_express", ficha.id), ficha);
  batch.set(doc(db, "collections_express", ficha.id), {
    ...ficha,
    installments: loan.installments,
    financed: loan.total,
  });
  await batch.commit();
}

export async function savePayment(kind: "sale" | "loan", item: Sale | Loan) {
  const { db } = await getFirebaseServices();
  const fichaId = `${kind}_${item.id}`;
  const batch = writeBatch(db);
  batch.set(doc(db, kind === "sale" ? "sales_express" : "loans_express", item.id), item);
  batch.set(doc(db, "fichas_express", fichaId), { item }, { merge: true });
  batch.set(doc(db, "collections_express", fichaId), { installments: item.installments }, { merge: true });
  await batch.commit();
}

export async function saveFinancingEdit(kind: "sale" | "loan", item: Sale | Loan, client: Client) {
  const { db } = await getFirebaseServices();
  const fichaId = `${kind}_${item.id}`;
  const financed = kind === "sale" ? (item as Sale).financed : (item as Loan).total;
  const batch = writeBatch(db);
  batch.set(doc(db, "clients_express", client.id), client);
  batch.set(doc(db, kind === "sale" ? "sales_express" : "loans_express", item.id), item);
  batch.set(
    doc(db, "fichas_express", fichaId),
    { clientName: client.name, clientId: client.id, item },
    { merge: true },
  );
  batch.set(
    doc(db, "collections_express", fichaId),
    {
      clientName: client.name,
      clientId: client.id,
      item,
      installments: item.installments,
      financed,
    },
    { merge: true },
  );
  await batch.commit();
}

export async function savePurchase(purchase: Purchase) {
  const { db } = await getFirebaseServices();
  await runTransaction(db, async (transaction) => {
    const productRefs = purchase.items.map((item) => doc(db, "products_express", item.productCode));
    const snapshots = await Promise.all(productRefs.map((reference) => transaction.get(reference)));
    snapshots.forEach((snapshot, index) => {
      const item = purchase.items[index];
      const reference = productRefs[index];
      if (item && reference && snapshot.exists()) {
        const currentStock = Number(snapshot.data()?.["stock"] ?? 0);
        transaction.update(reference, { stock: currentStock + item.quantity });
      }
    });
    transaction.set(doc(db, "purchases_express", purchase.id), purchase);
  });
}
