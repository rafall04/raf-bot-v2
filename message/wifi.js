const fs = require('fs');
const path = require('path');
const convertRupiah = require('rupiah-format');
const { templatesCache } = require('../lib/templating'); // Import the live cache

/**
 * Replaces placeholders in a template string with provided data.
 * @param {string} template The template string.
 * @param {object} data An object where keys are placeholder names and values are their replacements.
 * @returns {string} The formatted string.
 */
const formatTemplate = (template, data) => {
    if (!template) return '';
    let formatted = template;
    for (const key in data) {
        const regex = new RegExp(`\\$\\{${key}\\}`, 'g');
        formatted = formatted.replace(regex, data[key]);
    }
    return formatted;
};

exports.wifimenu = (nama, namabot) => {
    const template = templatesCache.wifiMenuTemplates?.wifimenu || '';
    return formatTemplate(template, { nama, namabot });
};

exports.customermenu = (nama, namabot) => {
    const template = templatesCache.wifiMenuTemplates?.customermenu || '';
    return formatTemplate(template, { nama, namabot });
};

exports.technicianmenu = (nama, namabot) => {
    const template = templatesCache.wifiMenuTemplates?.technicianmenu || '';
    return formatTemplate(template, { nama, namabot });
};

exports.menubelivoucher = (nama, namabot) => {
    const template = templatesCache.wifiMenuTemplates?.menubelivoucher || '';
    return formatTemplate(template, { nama, namabot });
};

exports.menuvoucher = (nama, namabot) => {
    const template = templatesCache.wifiMenuTemplates?.menuvoucher || '';
    return formatTemplate(template, { nama, namabot });
};

exports.menupasang = (nama, namabot) => {
    const template = templatesCache.wifiMenuTemplates?.menupasang || '';
    return formatTemplate(template, { nama, namabot });
};

exports.menuowner = (nama, namabot) => {
    const template = templatesCache.wifiMenuTemplates?.menuowner || '';
    return formatTemplate(template, { nama, namabot });
};

exports.menupaket = (nama, namabot) => {
    // Path to the packages.json file
    const packagesPath = path.join(__dirname, '../database/packages.json');
    let packages = [];

    try {
        const data = fs.readFileSync(packagesPath, 'utf8');
        packages = JSON.parse(data);
    } catch (error) {
        console.error("Error reading or parsing packages.json:", error);
        // Return a simple error message or a formatted one from a template if available
        return "Maaf, terjadi kesalahan saat memuat daftar paket. Silakan coba lagi nanti.";
    }

    // Filter packages that should be shown in monthly (showInMonthly !== false)
    const monthlyPackages = packages.filter(pkg => pkg.showInMonthly !== false);

    let packageList = '';
    if (monthlyPackages.length > 0) {
        packageList = monthlyPackages.map(pkg => {
            const formattedPrice = convertRupiah.convert(pkg.price);
            // Use displayProfile for customer-facing speed info, fallback to profile
            const displaySpeed = pkg.displayProfile || pkg.profile || '';
            // Use custom description if available
            const description = pkg.description || '';
            
            let packageInfo = `  • *${pkg.name}*`;
            if (displaySpeed) {
                packageInfo += `\n    🚀 ${displaySpeed}`;
            }
            if (description) {
                packageInfo += `\n    📝 ${description}`;
            }
            packageInfo += `\n    💰 ${formattedPrice} / bulan`;
            
            return packageInfo;
        }).join('\n\n');
    } else {
        packageList = 'Saat ini tidak ada paket bulanan yang tersedia.';
    }

    const template = templatesCache.wifiMenuTemplates?.menupaket || '';
    return formatTemplate(template, { nama, namabot, packageList });
};
