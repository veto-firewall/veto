# VETO: Advanced Web Filtering Extension

[![GitHub](https://img.shields.io/github/stars/veto-firewall/veto?style=social)](https://github.com/veto-firewall/veto)
[![Firefox Add-on](https://img.shields.io/amo/v/veto)](https://addons.mozilla.org/firefox/addon/veto-firewall/)
[![Quality Check](https://github.com/veto-firewall/veto/actions/workflows/ci.yml/badge.svg)](https://github.com/veto-firewall/veto/actions/workflows/ci.yml)
[![Release](https://github.com/veto-firewall/veto/actions/workflows/release.yml/badge.svg)](https://github.com/veto-firewall/veto/actions/workflows/release.yml)

VETO is a Firefox extension that provides advanced filtering capabilities with GeoIP, ASN, domain, URL, and content blocking. It serves as a simple firewall for privacy and security.

## Purpose and Features

VETO gives you fine-grained control over your browsing experience by allowing you to:

- **GeoIP Filtering**: Block or allow web requests based on the geographic location of the server
- **ASN Blocking**: Filter traffic from specific Autonomous System Numbers (network providers)
- **Domain & URL Filtering**: Create rules to block or allow specific domains and URLs
- **Content Blocking**: Filter out unwanted content from websites
- **Simple Interface**: Easy-to-use popup interface to manage all filtering rules

## How to Use

### Installation

Install VETO directly from the [Firefox Add-ons Store](https://addons.mozilla.org/firefox/addon/veto-firewall/).

### Using the Extension

1. **Access the Interface**: Click the VETO icon in your browser toolbar to open the popup interface
2. **Manage Rules**: Create, edit, and delete filtering rules through the intuitive interface
3. **Geographic Filtering**: Block or allow traffic from specific countries or regions
4. **Custom Rules**: Create custom rules for specific domains or content patterns
5. **Configure Settings**: Adjust extension settings to match your preferences

### Setting Up MaxMind for GeoIP and ASN Filtering

To use GeoIP and ASN filtering features, you'll need to create a free MaxMind account:

1. Go to [MaxMind's website](https://www.maxmind.com/en/geolite2/signup)
2. Sign up for a free GeoLite2 account
3. After creating your account, navigate to "My License Key" under "Services"
4. Generate a new license key
5. In the VETO extension settings, enter your MaxMind license key
6. Save your settings for the changes to take effect

### Example Use Cases

- Block traffic from specific countries for security reasons
- Prevent connections to known malicious ASNs
- Block ads and trackers using domain and content filtering
- Create custom rules to improve your browsing privacy

## Limitations

- **Firefox Only**: VETO is currently a Firefox-only extension (v3 Manifest)
- **Performance Impact**: While extensive filtering rules may slightly impact browsing performance, blocking ads, trackers, and heavy unwanted content can actually improve overall browsing speed
- **Complex Rules**: Some advanced rules may require technical knowledge to implement correctly
- **False Positives**: Geographic and ASN blocking may occasionally block legitimate content

## Technical Information

### Technology Stack

- **TypeScript**: Core language for development
- **Webpack**: Module bundling
- **ESLint**: Code quality and style enforcement
- **Mozilla Web Extensions API**: For browser integration

### Dependencies

The extension uses several key technologies:

- **Mozilla's WebExtension API**: For browser integration
- **declarativeNetRequest API**: For efficient network request filtering
- **Storage API**: For storing user preferences and rules
- **DNS API**: For domain name resolution

### Architecture

The extension follows a modular architecture:

- **Background Script**: Handles filtering logic and browser events
- **Popup Interface**: User interface for managing rules and settings
- **Utility Modules**: Handle specialized functions like GeoIP lookups

## Building and Publishing

### Prerequisites

- Node.js (v14+)
- npm or yarn

### Building from Source

1. Clone the repository:
   ```bash
   git clone https://github.com/veto-firewall/veto.git
   cd veto
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Build the extension:
   ```bash
   npm run build
   ```

4. The built extension will be available in the `dist` directory

### Publishing a New Release

The release process is fully automated through GitHub Actions:

1. Go to the [Actions tab](https://github.com/veto-firewall/veto/actions) in the GitHub repository
2. Select the "Release" workflow
3. Click on "Run workflow" and provide the following inputs:
   - **Version type**: Choose between `patch`, `minor`, or `major` to determine how the version number should be incremented
   - **Distribution channel**: Select `listed` for public distribution or `unlisted` for private distribution

The workflow (`.github/workflows/release.yml`) will automatically:
   - Update the version in `package.json` and `src/manifest.json`
   - Build the extension
   - Sign the extension with Mozilla's Web-Ext API
   - Create a GitHub release with:
     - Source code archive
     - Unsigned extension package (zip)
     - Signed extension package (xpi)
     - Checksums for all files
   - Submit the extension to Firefox Add-ons with the specified distribution channel

No manual steps are required as the entire process from version bumping to Firefox submission is handled by the workflow.

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the [LICENSE.txt](https://github.com/veto-firewall/veto/blob/main/LICENSE.txt) file for details.

---

Enjoy!