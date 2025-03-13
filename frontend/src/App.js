import { useEffect, useState } from "react";
import "./App.css";

function App() {
  const [products, setProducts] = useState([]);
  const apiBaseUrl = "https://bd7s28ccr4.execute-api.eu-north-1.amazonaws.com";

  // Fetch products on page load
  useEffect(() => {
    const fetchProducts = async () => {
      try {
        const response = await fetch(`${apiBaseUrl}/api/products`);
        const data = await response.json();
        setProducts(data);
      } catch (error) {
        console.error("Error fetching products:", error);
      }
    };
    fetchProducts();
  }, []);

  return (
    <div className="min-h-screen p-6 bg-gray-100">
      <h1 className="text-3xl font-bold mb-6">📦 Inventory Tracker</h1>

      {/* Check Price Button */}
      <button
        onClick={() => alert("Price check triggered!")}
        className="px-4 py-2 bg-blue-500 text-white rounded-lg mb-8"
      >
        🔍 Check Price Updates
      </button>

      {/* Product List */}
      <h2 className="text-2xl font-semibold mb-4">Your Products:</h2>
      {products.length === 0 ? (
        <p>No products available.</p>
      ) : (
        <ul className="space-y-4">
          {products.map((product) => (
            <li key={product.id} className="p-4 border rounded-lg shadow">
              <img src={product.image || "https://via.placeholder.com/150"} alt={product.name} className="w-32 h-32 object-cover mb-2" />
              <strong>{product.name}</strong> - 💰 ${product.price} - 📦{" "}
              {product.quantity ?? "Out of stock"}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default App;