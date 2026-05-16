// const express = require('express');
// const router = express.Router();
// const { authenticateToken } = require('../middleware/auth');

// // Mock database (replace with real database in production)
// let prescriptions = [
//   {
//     id: 'rx_1',
//     patient_id: 'p_123',
//     patient_name: 'Abebe Kebede',
//     card_number: 'OPD-2024-1234',
//     doctor_id: 'dr_456',
//     doctor_name: 'Tadesse',
//     ward: 'OPD',
//     priority: 'routine',
//     status: 'pending',
//     created_at: new Date().toISOString(),
//     items: [
//       {
//         name: 'Amoxicillin',
//         dosage: '500mg',
//         frequency: 'twice daily',
//         duration: '7 days',
//         route: 'oral',
//         quantity: 14,
//         notes: 'Take with food'
//       },
//       {
//         name: 'Paracetamol',
//         dosage: '1g',
//         frequency: 'when fever',
//         duration: '3 days',
//         route: 'oral',
//         quantity: 6,
//         notes: 'Take if temperature > 38°C'
//       }
//     ]
//   },
//   {
//     id: 'rx_2',
//     patient_id: 'p_124',
//     patient_name: 'Almaz Haile',
//     card_number: 'OPD-2024-1235',
//     doctor_id: 'dr_457',
//     doctor_name: 'Hailu',
//     ward: 'OPD',
//     priority: 'urgent',
//     status: 'pending',
//     created_at: new Date().toISOString(),
//     items: [
//       {
//         name: 'Metformin',
//         dosage: '500mg',
//         frequency: 'once daily',
//         duration: '30 days',
//         route: 'oral',
//         quantity: 30,
//         notes: 'Take with breakfast'
//       },
//       {
//         name: 'Glibenclamide',
//         dosage: '5mg',
//         frequency: 'once daily',
//         duration: '30 days',
//         route: 'oral',
//         quantity: 30,
//         notes: 'Take with breakfast'
//       }
//     ]
//   },
//   {
//     id: 'rx_3',
//     patient_id: 'p_125',
//     patient_name: 'Worku Desta',
//     card_number: 'EME-2024-5678',
//     doctor_id: 'dr_458',
//     doctor_name: 'Gebre',
//     ward: 'EME',
//     priority: 'stat',
//     status: 'prepared',
//     created_at: new Date().toISOString(),
//     items: [
//       {
//         name: 'Morphine',
//         dosage: '10mg',
//         frequency: 'every 4 hours PRN',
//         duration: '24 hours',
//         route: 'IV',
//         quantity: 6,
//         notes: 'For severe pain'
//       }
//     ]
//   }
// ];

// // Inventory mock data
// let inventory = [
//   { id: 'inv_1', name: 'Amoxicillin 500mg', stock: 100, unit: 'capsules', reorder_level: 20 },
//   { id: 'inv_2', name: 'Paracetamol 1g', stock: 50, unit: 'tablets', reorder_level: 30 },
//   { id: 'inv_3', name: 'Metformin 500mg', stock: 200, unit: 'tablets', reorder_level: 50 },
//   { id: 'inv_4', name: 'Ibuprofen 400mg', stock: 0, unit: 'tablets', reorder_level: 40 },
//   { id: 'inv_5', name: 'Morphine 10mg', stock: 25, unit: 'ampules', reorder_level: 10 }
// ];

// // GET /api/pharmacy/prescriptions - Get all prescriptions (filter by ward)
// router.get('/prescriptions', authenticateToken, (req, res) => {
//   try {
//     const { ward } = req.query;
//     let filteredPrescriptions = [...prescriptions];
    
//     if (ward && ward !== 'all') {
//       filteredPrescriptions = filteredPrescriptions.filter(p => p.ward === ward);
//     }
    
//     // Sort by priority and date
//     filteredPrescriptions.sort((a, b) => {
//       const priorityOrder = { stat: 0, urgent: 1, routine: 2 };
//       const priorityDiff = (priorityOrder[a.priority] || 2) - (priorityOrder[b.priority] || 2);
//       if (priorityDiff !== 0) return priorityDiff;
//       return new Date(b.created_at) - new Date(a.created_at);
//     });
    
//     res.json({
//       success: true,
//       prescriptions: filteredPrescriptions
//     });
//   } catch (error) {
//     console.error('Error fetching prescriptions:', error);
//     res.status(500).json({ success: false, message: 'Error fetching prescriptions' });
//   }
// });

// // GET /api/pharmacy/prescription/:id - Get single prescription
// router.get('/prescription/:id', authenticateToken, (req, res) => {
//   try {
//     const prescription = prescriptions.find(p => p.id === req.params.id);
//     if (!prescription) {
//       return res.status(404).json({ success: false, message: 'Prescription not found' });
//     }
    
//     // Check inventory for each item
//     const itemsWithStock = prescription.items.map(item => {
//       const inventoryItem = inventory.find(i => i.name === item.name);
//       return {
//         ...item,
//         in_stock: inventoryItem ? inventoryItem.stock >= item.quantity : false,
//         available_stock: inventoryItem ? inventoryItem.stock : 0,
//         inventory_id: inventoryItem?.id
//       };
//     });
    
//     res.json({
//       success: true,
//       prescription: { ...prescription, items: itemsWithStock }
//     });
//   } catch (error) {
//     console.error('Error fetching prescription:', error);
//     res.status(500).json({ success: false, message: 'Error fetching prescription' });
//   }
// });

// // POST /api/pharmacy/prepare/:id - Mark prescription as being prepared
// router.post('/prepare/:id', authenticateToken, (req, res) => {
//   try {
//     const prescription = prescriptions.find(p => p.id === req.params.id);
//     if (!prescription) {
//       return res.status(404).json({ success: false, message: 'Prescription not found' });
//     }
    
//     prescription.status = 'prepared';
//     prescription.prepared_at = new Date().toISOString();
//     prescription.prepared_by = req.user?.id || 'pharmacist_1';
    
//     res.json({
//       success: true,
//       message: 'Prescription marked as prepared',
//       prescription
//     });
//   } catch (error) {
//     console.error('Error preparing prescription:', error);
//     res.status(500).json({ success: false, message: 'Error preparing prescription' });
//   }
// });

// // POST /api/pharmacy/dispense - Dispense prescription
// router.post('/dispense', authenticateToken, (req, res) => {
//   try {
//     const { prescription_id, items, pharmacist_id, pharmacist_name } = req.body;
    
//     const prescription = prescriptions.find(p => p.id === prescription_id);
//     if (!prescription) {
//       return res.status(404).json({ success: false, message: 'Prescription not found' });
//     }
    
//     // Update inventory
//     items.forEach(item => {
//       const inventoryItem = inventory.find(i => i.name === item.name);
//       if (inventoryItem) {
//         inventoryItem.stock -= item.quantity || 1;
//         if (inventoryItem.stock < 0) inventoryItem.stock = 0;
//       }
//     });
    
//     prescription.status = 'dispensed';
//     prescription.dispensed_at = new Date().toISOString();
//     prescription.dispensed_by = pharmacist_name || req.user?.full_name || 'Pharmacist';
//     prescription.dispensed_items = items;
    
//     res.json({
//       success: true,
//       message: 'Prescription dispensed successfully',
//       prescription
//     });
//   } catch (error) {
//     console.error('Error dispensing prescription:', error);
//     res.status(500).json({ success: false, message: 'Error dispensing prescription' });
//   }
// });

// // GET /api/pharmacy/inventory - Get inventory status
// router.get('/inventory', authenticateToken, (req, res) => {
//   try {
//     const lowStock = inventory.filter(i => i.stock <= i.reorder_level);
    
//     res.json({
//       success: true,
//       inventory,
//       low_stock: lowStock,
//       total_items: inventory.length,
//       low_stock_count: lowStock.length
//     });
//   } catch (error) {
//     console.error('Error fetching inventory:', error);
//     res.status(500).json({ success: false, message: 'Error fetching inventory' });
//   }
// });

// // POST /api/pharmacy/inventory/update - Update inventory
// router.post('/inventory/update', authenticateToken, (req, res) => {
//   try {
//     const { inventory_id, quantity, operation } = req.body;
    
//     const inventoryItem = inventory.find(i => i.id === inventory_id);
//     if (!inventoryItem) {
//       return res.status(404).json({ success: false, message: 'Inventory item not found' });
//     }
    
//     if (operation === 'add') {
//       inventoryItem.stock += quantity;
//     } else if (operation === 'remove') {
//       inventoryItem.stock -= quantity;
//       if (inventoryItem.stock < 0) inventoryItem.stock = 0;
//     }
    
//     res.json({
//       success: true,
//       message: 'Inventory updated',
//       item: inventoryItem
//     });
//   } catch (error) {
//     console.error('Error updating inventory:', error);
//     res.status(500).json({ success: false, message: 'Error updating inventory' });
//   }
// });

// module.exports = router;