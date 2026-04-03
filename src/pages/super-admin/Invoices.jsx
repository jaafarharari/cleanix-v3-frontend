import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/lib/AuthContext';
import { ArrowLeft, FileText, Download, Loader2, Shield, LogOut, Building2, Calculator } from 'lucide-react';
import { format, startOfWeek, addDays, subWeeks } from 'date-fns';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';
function authFetch(path) {
  return fetch(`${API_URL}${path}`, { headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${localStorage.getItem('cleanix_access_token')}` } }).then(async r => { const j = await r.json(); if (!r.ok) throw new Error(j.error); return j; });
}

export default function Invoices() {
  const { logout } = useAuth();
  const [orgs, setOrgs] = useState([]);
  const [loading, setLoading] = useState(true);

  // Form state
  const [selectedOrg, setSelectedOrg] = useState('');
  const [dateFrom, setDateFrom] = useState(format(subWeeks(startOfWeek(new Date(), { weekStartsOn: 1 }), 1), 'yyyy-MM-dd'));
  const [dateTo, setDateTo] = useState(format(addDays(subWeeks(startOfWeek(new Date(), { weekStartsOn: 1 }), 1), 6), 'yyyy-MM-dd'));
  const [hourlyRate, setHourlyRate] = useState('15.00');
  const [travelRate, setTravelRate] = useState('12.00');
  const [invoiceNumber, setInvoiceNumber] = useState(`INV-${format(new Date(), 'yyyyMMdd')}-001`);
  const [customerName, setCustomerName] = useState('');
  const [customerAddress, setCustomerAddress] = useState('');
  const [customerEmail, setCustomerEmail] = useState('');
  const [companyName, setCompanyName] = useState('CleanOps Ltd');
  const [companyAddress, setCompanyAddress] = useState('');
  const [companyEmail, setCompanyEmail] = useState('');
  const [notes, setNotes] = useState('Payment due within 30 days.');
  const [vatRate, setVatRate] = useState('0');

  // Data
  const [reportData, setReportData] = useState(null);
  const [fetchingData, setFetchingData] = useState(false);
  const [generating, setGenerating] = useState(false);

  useEffect(() => {
    authFetch('/api/invoices/orgs').then(d => { setOrgs(d); setLoading(false); }).catch(() => setLoading(false));
  }, []);

  const handleFetchData = async () => {
    if (!selectedOrg || !dateFrom || !dateTo) return;
    setFetchingData(true);
    try {
      const data = await authFetch(`/api/invoices/org-data/${selectedOrg}?from=${dateFrom}&to=${dateTo}`);
      setReportData(data);
      if (!customerName && data.organisation?.name) setCustomerName(data.organisation.name);
    } catch (e) { alert(e.message); }
    setFetchingData(false);
  };

  const rate = parseFloat(hourlyRate) || 0;
  const tRate = parseFloat(travelRate) || 0;
  const vat = parseFloat(vatRate) || 0;

  const cleanTotal = reportData ? reportData.summary.total_clean_hours * rate : 0;
  const travelTotal = reportData ? reportData.summary.total_travel_hours * tRate : 0;
  const subtotal = cleanTotal + travelTotal;
  const vatAmount = subtotal * (vat / 100);
  const grandTotal = subtotal + vatAmount;

  const generatePDF = async () => {
    setGenerating(true);
    try {
      // Dynamically import jspdf
      const { default: jsPDF } = await import('jspdf');

      const doc = new jsPDF();
      const w = doc.internal.pageSize.getWidth();
      let y = 20;

      // Header
      doc.setFontSize(24);
      doc.setFont('helvetica', 'bold');
      doc.text('INVOICE', 20, y);
      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(100);
      doc.text(invoiceNumber, 20, y + 8);
      doc.text(`Date: ${format(new Date(), 'dd MMM yyyy')}`, 20, y + 14);

      // Company info (right side)
      doc.setTextColor(0);
      doc.setFontSize(11);
      doc.setFont('helvetica', 'bold');
      doc.text(companyName, w - 20, y, { align: 'right' });
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      doc.setTextColor(80);
      if (companyAddress) { companyAddress.split('\n').forEach((line, i) => doc.text(line, w - 20, y + 7 + i * 4, { align: 'right' })); }
      if (companyEmail) doc.text(companyEmail, w - 20, y + 7 + (companyAddress.split('\n').length) * 4, { align: 'right' });

      y += 35;

      // Bill to
      doc.setTextColor(100);
      doc.setFontSize(9);
      doc.text('BILL TO', 20, y);
      y += 6;
      doc.setTextColor(0);
      doc.setFontSize(11);
      doc.setFont('helvetica', 'bold');
      doc.text(customerName, 20, y);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      doc.setTextColor(80);
      if (customerAddress) { customerAddress.split('\n').forEach((line, i) => doc.text(line, 20, y + 5 + i * 4)); }
      if (customerEmail) doc.text(customerEmail, 20, y + 5 + (customerAddress.split('\n').length) * 4);

      // Period
      doc.setTextColor(100);
      doc.text('PERIOD', w - 20, y - 6, { align: 'right' });
      doc.setTextColor(0);
      doc.setFontSize(10);
      doc.text(`${format(new Date(dateFrom), 'dd MMM yyyy')} — ${format(new Date(dateTo), 'dd MMM yyyy')}`, w - 20, y, { align: 'right' });

      y += 25;

      // Divider
      doc.setDrawColor(200);
      doc.line(20, y, w - 20, y);
      y += 10;

      // Table header
      doc.setFillColor(245, 245, 245);
      doc.rect(20, y - 4, w - 40, 10, 'F');
      doc.setFontSize(8);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(80);
      doc.text('Cleaner', 22, y + 2);
      doc.text('Jobs', 95, y + 2, { align: 'center' });
      doc.text('Clean hrs', 115, y + 2, { align: 'center' });
      doc.text('Travel hrs', 140, y + 2, { align: 'center' });
      doc.text('Total hrs', 165, y + 2, { align: 'center' });
      y += 12;

      // Table rows
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(40);
      doc.setFontSize(9);
      for (const cleaner of (reportData?.cleaners || [])) {
        doc.text(cleaner.name, 22, y);
        doc.text(String(cleaner.jobs_completed), 95, y, { align: 'center' });
        doc.text(cleaner.clean_hours.toFixed(2), 115, y, { align: 'center' });
        doc.text(cleaner.travel_hours.toFixed(2), 140, y, { align: 'center' });
        doc.text(cleaner.total_hours.toFixed(2), 165, y, { align: 'center' });
        y += 7;
      }

      y += 5;
      doc.setDrawColor(200);
      doc.line(20, y, w - 20, y);
      y += 10;

      // Summary
      const sumX = w - 20;
      const labelX = w - 80;
      doc.setFontSize(10);

      doc.setFont('helvetica', 'normal');
      doc.setTextColor(80);
      doc.text('Cleaning hours:', labelX, y);
      doc.setTextColor(0);
      doc.text(`${reportData?.summary.total_clean_hours.toFixed(2)} hrs × £${rate.toFixed(2)}`, sumX - 50, y);
      doc.setFont('helvetica', 'bold');
      doc.text(`£${cleanTotal.toFixed(2)}`, sumX, y, { align: 'right' });
      y += 7;

      doc.setFont('helvetica', 'normal');
      doc.setTextColor(80);
      doc.text('Travel hours:', labelX, y);
      doc.setTextColor(0);
      doc.text(`${reportData?.summary.total_travel_hours.toFixed(2)} hrs × £${tRate.toFixed(2)}`, sumX - 50, y);
      doc.setFont('helvetica', 'bold');
      doc.text(`£${travelTotal.toFixed(2)}`, sumX, y, { align: 'right' });
      y += 10;

      doc.setDrawColor(220);
      doc.line(labelX, y, sumX, y);
      y += 7;

      doc.setFont('helvetica', 'normal');
      doc.setTextColor(80);
      doc.text('Subtotal:', labelX, y);
      doc.setTextColor(0);
      doc.setFont('helvetica', 'bold');
      doc.text(`£${subtotal.toFixed(2)}`, sumX, y, { align: 'right' });
      y += 7;

      if (vat > 0) {
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(80);
        doc.text(`VAT (${vat}%):`, labelX, y);
        doc.setTextColor(0);
        doc.setFont('helvetica', 'bold');
        doc.text(`£${vatAmount.toFixed(2)}`, sumX, y, { align: 'right' });
        y += 7;
      }

      y += 3;
      doc.setFillColor(30, 41, 59);
      doc.rect(labelX - 5, y - 5, sumX - labelX + 10, 14, 'F');
      doc.setTextColor(255);
      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      doc.text('TOTAL:', labelX, y + 4);
      doc.text(`£${grandTotal.toFixed(2)}`, sumX, y + 4, { align: 'right' });

      y += 25;

      // Notes
      if (notes) {
        doc.setTextColor(120);
        doc.setFontSize(8);
        doc.setFont('helvetica', 'normal');
        doc.text('Notes:', 20, y);
        doc.setTextColor(80);
        doc.text(notes, 20, y + 5);
      }

      // Footer
      doc.setTextColor(180);
      doc.setFontSize(7);
      doc.text('Generated by CleanOps', w / 2, doc.internal.pageSize.getHeight() - 10, { align: 'center' });

      // Save
      doc.save(`${invoiceNumber}.pdf`);
    } catch (e) {
      console.error('PDF generation failed:', e);
      alert('Failed to generate PDF: ' + e.message);
    }
    setGenerating(false);
  };

  return (
    <div className="min-h-screen bg-dark-900">
      <header className="bg-dark-800/80 backdrop-blur-xl border-b border-dark-700/50 px-4 py-3 sticky top-0 z-40">
        <div className="max-w-5xl mx-auto flex items-center gap-4">
          <Link to="/super"><button className="btn-ghost p-2"><ArrowLeft className="w-4 h-4" /></button></Link>
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-purple-600 flex items-center justify-center shadow-lg shadow-purple-600/20">
              <Shield className="w-4 h-4 text-white" />
            </div>
            <span className="font-bold text-white text-sm">CleanOps</span>
            <span className="badge bg-purple-500/15 text-purple-400 border border-purple-500/20 text-[10px]">Invoicing</span>
          </div>
          <div className="ml-auto"><button onClick={logout} className="btn-ghost p-2"><LogOut className="w-4 h-4" /></button></div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-6 py-8 space-y-6">
        <div className="flex items-center gap-3">
          <FileText className="w-5 h-5 text-purple-400" />
          <h1 className="text-xl font-bold text-white">Generate invoice</h1>
        </div>

        {/* Step 1: Select org and dates */}
        <div className="card p-5 space-y-4">
          <h2 className="font-semibold text-white flex items-center gap-2"><Building2 className="w-4 h-4 text-accent" /> Select organisation and period</h2>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="text-xs text-dark-400 block mb-1.5">Organisation</label>
              <select className="input-dark w-full" value={selectedOrg} onChange={e => { setSelectedOrg(e.target.value); setReportData(null); }}>
                <option value="">Select...</option>
                {orgs.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs text-dark-400 block mb-1.5">From</label>
              <input type="date" className="input-dark w-full" value={dateFrom} onChange={e => { setDateFrom(e.target.value); setReportData(null); }} />
            </div>
            <div>
              <label className="text-xs text-dark-400 block mb-1.5">To</label>
              <input type="date" className="input-dark w-full" value={dateTo} onChange={e => { setDateTo(e.target.value); setReportData(null); }} />
            </div>
          </div>
          <button className="btn-primary w-full flex items-center justify-center gap-2" onClick={handleFetchData} disabled={!selectedOrg || fetchingData}>
            {fetchingData ? <Loader2 className="w-4 h-4 animate-spin" /> : <Calculator className="w-4 h-4" />} Pull report data
          </button>
        </div>

        {/* Step 2: Report data */}
        {reportData && (
          <>
            <div className="card p-5">
              <h2 className="font-semibold text-white mb-3">Cleaner hours — {reportData.organisation.name}</h2>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-dark-400 text-xs">
                      <th className="text-left py-2 px-2">Cleaner</th>
                      <th className="text-center py-2 px-2">Jobs</th>
                      <th className="text-center py-2 px-2">Clean hrs</th>
                      <th className="text-center py-2 px-2">Travel hrs</th>
                      <th className="text-center py-2 px-2">Total hrs</th>
                    </tr>
                  </thead>
                  <tbody>
                    {reportData.cleaners.map((c, i) => (
                      <tr key={i} className="border-t border-dark-700/50">
                        <td className="py-2 px-2 text-white">{c.name}</td>
                        <td className="py-2 px-2 text-center text-dark-300">{c.jobs_completed}</td>
                        <td className="py-2 px-2 text-center text-accent-light">{c.clean_hours.toFixed(2)}</td>
                        <td className="py-2 px-2 text-center text-teal-400">{c.travel_hours.toFixed(2)}</td>
                        <td className="py-2 px-2 text-center text-purple-300 font-medium">{c.total_hours.toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="border-t border-dark-600 font-bold">
                      <td className="py-2 px-2 text-dark-300">Totals</td>
                      <td className="py-2 px-2 text-center text-dark-200">{reportData.summary.total_jobs}</td>
                      <td className="py-2 px-2 text-center text-accent-light">{reportData.summary.total_clean_hours.toFixed(2)}</td>
                      <td className="py-2 px-2 text-center text-teal-400">{reportData.summary.total_travel_hours.toFixed(2)}</td>
                      <td className="py-2 px-2 text-center text-purple-300">{reportData.summary.total_hours.toFixed(2)}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
              {reportData.cleaners.length === 0 && <p className="text-dark-500 text-sm text-center py-4">No completed jobs in this period.</p>}
            </div>

            {/* Step 3: Invoice details */}
            <div className="card p-5 space-y-4">
              <h2 className="font-semibold text-white">Invoice details</h2>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs text-dark-400 block mb-1.5">Your company name</label>
                  <input className="input-dark w-full" value={companyName} onChange={e => setCompanyName(e.target.value)} />
                </div>
                <div>
                  <label className="text-xs text-dark-400 block mb-1.5">Invoice number</label>
                  <input className="input-dark w-full" value={invoiceNumber} onChange={e => setInvoiceNumber(e.target.value)} />
                </div>
                <div>
                  <label className="text-xs text-dark-400 block mb-1.5">Your address</label>
                  <textarea className="input-dark w-full resize-none" rows={2} value={companyAddress} onChange={e => setCompanyAddress(e.target.value)} placeholder="123 Street&#10;City, Postcode" />
                </div>
                <div>
                  <label className="text-xs text-dark-400 block mb-1.5">Your email</label>
                  <input className="input-dark w-full" value={companyEmail} onChange={e => setCompanyEmail(e.target.value)} placeholder="billing@company.com" />
                </div>
              </div>

              <div className="border-t border-dark-700 pt-4">
                <h3 className="text-sm font-medium text-dark-300 mb-3">Bill to</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs text-dark-400 block mb-1.5">Customer name</label>
                    <input className="input-dark w-full" value={customerName} onChange={e => setCustomerName(e.target.value)} />
                  </div>
                  <div>
                    <label className="text-xs text-dark-400 block mb-1.5">Customer email</label>
                    <input className="input-dark w-full" value={customerEmail} onChange={e => setCustomerEmail(e.target.value)} />
                  </div>
                  <div className="col-span-2">
                    <label className="text-xs text-dark-400 block mb-1.5">Customer address</label>
                    <textarea className="input-dark w-full resize-none" rows={2} value={customerAddress} onChange={e => setCustomerAddress(e.target.value)} placeholder="123 Street&#10;City, Postcode" />
                  </div>
                </div>
              </div>

              <div className="border-t border-dark-700 pt-4">
                <h3 className="text-sm font-medium text-dark-300 mb-3">Rates</h3>
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label className="text-xs text-dark-400 block mb-1.5">Cleaning rate (£/hr)</label>
                    <input type="number" step="0.01" className="input-dark w-full" value={hourlyRate} onChange={e => setHourlyRate(e.target.value)} />
                  </div>
                  <div>
                    <label className="text-xs text-dark-400 block mb-1.5">Travel rate (£/hr)</label>
                    <input type="number" step="0.01" className="input-dark w-full" value={travelRate} onChange={e => setTravelRate(e.target.value)} />
                  </div>
                  <div>
                    <label className="text-xs text-dark-400 block mb-1.5">VAT (%)</label>
                    <input type="number" step="0.1" className="input-dark w-full" value={vatRate} onChange={e => setVatRate(e.target.value)} />
                  </div>
                </div>
              </div>

              <div>
                <label className="text-xs text-dark-400 block mb-1.5">Notes</label>
                <textarea className="input-dark w-full resize-none" rows={2} value={notes} onChange={e => setNotes(e.target.value)} />
              </div>
            </div>

            {/* Step 4: Summary and generate */}
            <div className="card p-5 space-y-3">
              <h2 className="font-semibold text-white">Invoice summary</h2>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between text-dark-300">
                  <span>Cleaning: {reportData.summary.total_clean_hours.toFixed(2)} hrs × £{rate.toFixed(2)}</span>
                  <span className="text-white font-medium">£{cleanTotal.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-dark-300">
                  <span>Travel: {reportData.summary.total_travel_hours.toFixed(2)} hrs × £{tRate.toFixed(2)}</span>
                  <span className="text-white font-medium">£{travelTotal.toFixed(2)}</span>
                </div>
                <div className="border-t border-dark-700 pt-2 flex justify-between text-dark-300">
                  <span>Subtotal</span>
                  <span className="text-white font-medium">£{subtotal.toFixed(2)}</span>
                </div>
                {vat > 0 && (
                  <div className="flex justify-between text-dark-300">
                    <span>VAT ({vat}%)</span>
                    <span className="text-white font-medium">£{vatAmount.toFixed(2)}</span>
                  </div>
                )}
                <div className="border-t border-dark-600 pt-2 flex justify-between">
                  <span className="font-bold text-white text-lg">Total</span>
                  <span className="font-bold text-purple-300 text-lg">£{grandTotal.toFixed(2)}</span>
                </div>
              </div>
              <button className="btn-primary w-full h-12 flex items-center justify-center gap-2 bg-purple-600 hover:bg-purple-700 mt-4" onClick={generatePDF} disabled={generating || !customerName}>
                {generating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                Generate PDF invoice
              </button>
            </div>
          </>
        )}
      </main>
    </div>
  );
}