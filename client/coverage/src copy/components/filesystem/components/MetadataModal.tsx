import React, { useState, useEffect } from 'react'; // Removed useMemo as it wasn't used
import type { FileMetadata } from '../types';
import styles from '../BasicFileSystem.module.css';
import path from 'path-browserify';

interface MetadataModalProps {
    file: File | null;
    isOpen: boolean;
    onClose: () => void;
    onUpload: (file: File | null, metadata: FileMetadata, targetPath: string) => Promise<void>;
    currentDirectory: string;
    initialMetadata?: FileMetadata;
    editingItemPath?: string;
}

// --- Options for Dropdowns ---
const metadataOptions = {
    documentType: ["constitution", "amendment", "section", "article", "preamble", "annexure", "bill", "act", "regulation"],
    level: ["fonds", "series", "subseries", "file", "item"],
    language: ["en", "fr", "af", "zu", "xh", "ts", "st", "ve", "tn", "ss", "nr", "nso"],
    accessLevel: ["public", "restricted", "admin-only"],
    fileType: ["pdf", "docx", "txt", "jpeg", "png", "mp3", "mp4", "wav", "avi"], // Note: This might be better derived from the file itself
    country: ["South Africa", "Namibia", "Botswana", "Zimbabwe", "Lesotho", "Eswatini", "Mozambique"],
    jurisdiction: ["National", "Western Cape", "Gauteng", "KwaZulu-Natal", "Eastern Cape", "Free State", "Limpopo", "Mpumalanga", "North West", "Northern Cape"],
    license: ["Creative Commons BY-SA", "Creative Commons BY-NC", "Public Domain", "Government Copyright", "All Rights Reserved"],
    collection: ["1996 Constitution", "Bill of Rights Archive", "Transitional Provisions", "2021 Amendments", "Pre-Apartheid Legislation"],
    // Tags, Topics, EntitiesMentioned are better as free text input (comma-separated) for flexibility
};
// --- End Options ---

// --- Helper function to sanitize path segments ---
const sanitizePathSegment = (segment: string | undefined | null, fallback = '_unknown_'): string => {
    if (!segment || typeof segment !== 'string' || segment.trim() === '') {
        return fallback;
    }
    // Replace invalid characters (like / \ : * ? " < > |) and multiple spaces/dots
    return segment
        .trim()
        .replace(/[\\/:\*\?"<>\|]/g, '_') // Replace forbidden chars with underscore
        .replace(/\s+/g, '_') // Replace spaces with underscore
        .replace(/\.+/g, '.'); // Avoid multiple dots
};
// --- End Helper ---

const MetadataModal: React.FC<MetadataModalProps> = ({
    file,
    isOpen,
    onClose,
    onUpload,
    currentDirectory, // Keep for context, but path is now built from metadata
    initialMetadata,
    editingItemPath,
}) => {
    // --- Original filename (keep for final part) ---
    const originalFileName = editingItemPath ? path.basename(editingItemPath) : file?.name || 'unknown_file';
    // --- End Original filename ---

    // State for form fields
    const [documentType, setDocumentType] = useState('');
    const [level, setLevel] = useState('');
    const [language, setLanguage] = useState('');
    const [tags, setTags] = useState(''); // Keep as comma-separated input
    const [topics, setTopics] = useState(''); // Keep as comma-separated input
    const [accessLevel, setAccessLevel] = useState('');
    const [fileType, setFileType] = useState('');
    const [country, setCountry] = useState('');
    const [jurisdiction, setJurisdiction] = useState('');
    const [license, setLicense] = useState('');
    const [entitiesMentioned, setEntitiesMentioned] = useState(''); // Keep as comma-separated input
    const [collection, setCollection] = useState('');
    const [description, setDescription] = useState(''); // Add state for description
    const [targetPath, setTargetPath] = useState(''); // Add state for target path
    const [documentId, setDocumentId] = useState<string | undefined>(undefined); // Add state for documentId
    const [isUploading, setIsUploading] = useState(false);
    const [uploadError, setUploadError] = useState<string | null>(null);

    // Function to calculate predicted path
    const calculatePredictedPath = () => {
        // Only calculate for new uploads
        if (editingItemPath) return '';

        const countrySegment = sanitizePathSegment(country, '_NoCountry_');
        const jurisdictionSegment = sanitizePathSegment(jurisdiction, '_NoJurisdiction_');
        const docTypeSegment = sanitizePathSegment(documentType, '_NoDocType_');
        const langSegment = sanitizePathSegment(language, '_NoLang_');
        const sanitizedFileName = sanitizePathSegment(originalFileName, 'uploaded_file.bin');

        return [
            countrySegment,
            jurisdictionSegment,
            docTypeSegment,
            langSegment,
            sanitizedFileName
        ].join('/').replace(/\\/g, '/');
    };

    useEffect(() => {
        console.log("[MetadataModal useEffect] Running effect. isOpen:", isOpen);
        console.log("[MetadataModal useEffect] editingItemPath:", editingItemPath);
        console.log("[MetadataModal useEffect] Received initialMetadata:", initialMetadata ? JSON.stringify(initialMetadata) : 'undefined');

        if (initialMetadata) {
            console.log("[MetadataModal useEffect] Populating fields from initialMetadata...");
            // --- Add detailed logging for each field ---
            const id = initialMetadata.documentId || undefined;
            const docType = initialMetadata.documentType || '';
            const lvl = initialMetadata.level || '';
            const lang = initialMetadata.language || '';
            const tgs = initialMetadata.tags?.join(', ') || '';
            const tps = initialMetadata.topics?.join(', ') || '';
            const access = initialMetadata.accessLevel || '';
            const fType = initialMetadata.fileType || '';
            const ctry = initialMetadata.country || '';
            const juris = initialMetadata.jurisdiction || '';
            const lic = initialMetadata.license || '';
            const entities = initialMetadata.entitiesMentioned?.join(', ') || '';
            const coll = initialMetadata.collection || '';
            const desc = initialMetadata.description || '';

            console.log(`  -> documentId: ${id}`);
            console.log(`  -> documentType: ${docType}`);
            console.log(`  -> level: ${lvl}`);
            console.log(`  -> language: ${lang}`);
            console.log(`  -> tags: ${tgs}`);
            console.log(`  -> topics: ${tps}`);
            console.log(`  -> accessLevel: ${access}`);
            console.log(`  -> fileType: ${fType}`);
            console.log(`  -> country: ${ctry}`);
            console.log(`  -> jurisdiction: ${juris}`);
            console.log(`  -> license: ${lic}`);
            console.log(`  -> entitiesMentioned: ${entities}`);
            console.log(`  -> collection: ${coll}`);
            console.log(`  -> description: ${desc}`);
            // --- End detailed logging ---

            // Set state based on received props
            setDocumentId(id);
            setDocumentType(docType);
            setLevel(lvl);
            setLanguage(lang);
            setTags(tgs);
            setTopics(tps);
            setAccessLevel(access);
            setFileType(fType);
            setCountry(ctry);
            setJurisdiction(juris);
            setLicense(lic);
            setEntitiesMentioned(entities);
            setCollection(coll);
            setDescription(desc);
        } else {
            console.log("[MetadataModal useEffect] Resetting fields (no initialMetadata).");
            // Reset form for new upload
            setDocumentId(undefined);
            setDocumentType('');
            setLevel('');
            setLanguage('');
            setTags('');
            setTopics('');
            setAccessLevel('');
            setFileType('');
            setCountry('');
            setJurisdiction('');
            setLicense('');
            setEntitiesMentioned('');
            setCollection('');
            setDescription('');
        }

        // Set Target Path
        if (editingItemPath) {
            setTargetPath(editingItemPath);
        } else {
            setTargetPath(calculatePredictedPath());
        }

        setUploadError(null);
        setIsUploading(false);
        console.log("[MetadataModal useEffect] Effect finished.");
    }, [initialMetadata, editingItemPath, isOpen]);

    // Effect to update predicted path when metadata changes (for new uploads only)
    useEffect(() => {
        if (!editingItemPath) { // Only update path prediction for new uploads
            setTargetPath(calculatePredictedPath());
        }
    }, [country, jurisdiction, documentType, language, originalFileName, editingItemPath]);

    const handleUploadClick = async () => {
        const metadata: FileMetadata = {
            documentId: documentId, // Include documentId (will be undefined for new uploads initially)
            documentType: documentType || undefined,
            level: level || undefined,
            language: language || undefined,
            tags: tags.split(',').map(t => t.trim()).filter(t => t),
            topics: topics.split(',').map(t => t.trim()).filter(t => t),
            accessLevel: accessLevel || undefined,
            fileType: fileType || undefined,
            country: country || undefined,
            jurisdiction: jurisdiction || undefined,
            license: license || undefined,
            entitiesMentioned: entitiesMentioned.split(',').map(t => t.trim()).filter(t => t),
            collection: collection || undefined,
            description: description || undefined, // Include description
        };

        // Validation
        if (!editingItemPath && !file) {
            setUploadError("No file selected for upload.");
            return;
        }
        // Validate the user-editable targetPath for new uploads
        if (!editingItemPath && (!targetPath || targetPath.trim() === '' || targetPath.startsWith('/'))) {
             setUploadError("Invalid target path specified.");
             return;
        }

        // Use targetPath state directly
        const finalTargetPath = targetPath.replace(/\\/g, '/'); // Ensure forward slashes
        console.log(`[MetadataModal] Uploading/Updating with Target Path: ${finalTargetPath}`);

        setIsUploading(true);
        setUploadError(null);

        try {
            // Pass the finalTargetPath to the upload function
            await onUpload(file, metadata, finalTargetPath);
        } catch (error: any) {
            console.error("Upload error in modal:", error);
            setUploadError(error.message || "An unknown error occurred during upload.");
        }
    };

    const modalTitle = editingItemPath ? `Edit Metadata: ${originalFileName}` : `Upload File: ${originalFileName}`;

    // Helper to render select options
    const renderOptions = (options: string[]) => {
        return [
            <option key="" value="">-- Select --</option>, // Add a default empty option
            ...options.map(opt => <option key={opt} value={opt}>{opt}</option>)
        ];
    };

    if (!isOpen) return null;

    return (
        <div className={styles.modalOverlay}>
            <div className={styles.modalContent} style={{ color: '#000' }}>
                <h3>{modalTitle}</h3>
                <button onClick={onClose} className={styles.modalCloseButton} disabled={isUploading}>&times;</button>

                <form onSubmit={(e) => e.preventDefault()}>
                    {/* --- Display Document ID (Read-Only) --- */}
                    {documentId && (
                         <div className={styles.formGroup}>
                            <label htmlFor="documentIdDisplay">Document ID:</label>
                            <input
                                id="documentIdDisplay"
                                type="text"
                                value={documentId}
                                readOnly
                                disabled // Visually indicate read-only
                                style={{ backgroundColor: '#e9ecef', cursor: 'not-allowed' }} // Optional styling
                                title="Unique identifier for this document concept"
                            />
                            <small>This unique ID links versions or copies of the same document.</small>
                        </div>
                    )}
                    {/* --- End Display Document ID --- */}

                    {/* Document Type */}
                    <div className={styles.formGroup}>
                        <label htmlFor="documentType">Document Type:</label>
                        <select id="documentType" value={documentType} onChange={(e) => setDocumentType(e.target.value)} disabled={isUploading}>
                            {renderOptions(metadataOptions.documentType)}
                        </select>
                    </div>
                    {/* Level */}
                    <div className={styles.formGroup}>
                        <label htmlFor="level">Level:</label>
                        <select id="level" value={level} onChange={(e) => setLevel(e.target.value)} disabled={isUploading}>
                            {renderOptions(metadataOptions.level)}
                        </select>
                    </div>
                    {/* Language */}
                    <div className={styles.formGroup}>
                        <label htmlFor="language">Language:</label>
                        <select id="language" value={language} onChange={(e) => setLanguage(e.target.value)} disabled={isUploading}>
                            {renderOptions(metadataOptions.language)}
                        </select>
                    </div>
                    {/* Tags */}
                    <div className={styles.formGroup}>
                        <label htmlFor="tags">Tags (comma-separated):</label>
                        <input id="tags" type="text" value={tags} onChange={(e) => setTags(e.target.value)} disabled={isUploading} />
                    </div>
                    {/* Topics */}
                    <div className={styles.formGroup}>
                        <label htmlFor="topics">Topics (comma-separated):</label>
                        <input id="topics" type="text" value={topics} onChange={(e) => setTopics(e.target.value)} disabled={isUploading} />
                    </div>
                    {/* Entities Mentioned */}
                     <div className={styles.formGroup}>
                        <label htmlFor="entitiesMentioned">Entities Mentioned (comma-separated):</label>
                        <input id="entitiesMentioned" type="text" value={entitiesMentioned} onChange={(e) => setEntitiesMentioned(e.target.value)} disabled={isUploading} />
                    </div>
                    {/* Access Level */}
                    <div className={styles.formGroup}>
                        <label htmlFor="accessLevel">Access Level:</label>
                        <select id="accessLevel" value={accessLevel} onChange={(e) => setAccessLevel(e.target.value)} disabled={isUploading}>
                            {renderOptions(metadataOptions.accessLevel)}
                        </select>
                    </div>
                    {/* File Type */}
                    <div className={styles.formGroup}>
                        <label htmlFor="fileType">File Type:</label>
                        <select id="fileType" value={fileType} onChange={(e) => setFileType(e.target.value)} disabled={isUploading}>
                             {renderOptions(metadataOptions.fileType)}
                        </select>
                        <small>Note: This is metadata, not the actual file extension.</small>
                    </div>
                    {/* Country */}
                    <div className={styles.formGroup}>
                        <label htmlFor="country">Country:</label>
                        <select id="country" value={country} onChange={(e) => setCountry(e.target.value)} disabled={isUploading}>
                             {renderOptions(metadataOptions.country)}
                        </select>
                    </div>
                    {/* Jurisdiction */}
                    <div className={styles.formGroup}>
                        <label htmlFor="jurisdiction">Jurisdiction:</label>
                        <select id="jurisdiction" value={jurisdiction} onChange={(e) => setJurisdiction(e.target.value)} disabled={isUploading}>
                             {renderOptions(metadataOptions.jurisdiction)}
                        </select>
                    </div>
                    {/* License */}
                    <div className={styles.formGroup}>
                        <label htmlFor="license">License:</label>
                        <select id="license" value={license} onChange={(e) => setLicense(e.target.value)} disabled={isUploading}>
                             {renderOptions(metadataOptions.license)}
                        </select>
                    </div>
                    {/* Collection */}
                    <div className={styles.formGroup}>
                        <label htmlFor="collection">Collection:</label>
                        <select id="collection" value={collection} onChange={(e) => setCollection(e.target.value)} disabled={isUploading}>
                             {renderOptions(metadataOptions.collection)}
                        </select>
                    </div>
                    {/* Description */}
                     <div className={styles.formGroup}>
                        <label htmlFor="description">Description (Optional):</label>
                        <textarea
                            id="description"
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            disabled={isUploading}
                            rows={3}
                            className={styles.textareaInput} // Ensure this class exists or use formGroup textarea style
                        />
                    </div>

                    {/* --- Target Path Input (Only for New Uploads) --- */}
                    <div className={styles.formGroup}>
                        <label htmlFor="targetPath">
                            {editingItemPath ? 'File Path (Read-only):' : 'Target Path:'}
                        </label>
                        <input
                            id="targetPath"
                            type="text"
                            value={targetPath}
                            onChange={(e) => setTargetPath(e.target.value)}
                            disabled={isUploading || !!editingItemPath} // Disable if uploading or editing existing metadata
                            title={editingItemPath ? 'Path cannot be changed when editing metadata.' : 'Predicted path based on metadata. You can override this.'}
                        />
                        {!editingItemPath && <small>Predicted path based on metadata. Edit if needed.</small>}
                    </div>
                    {/* --- End Target Path Input --- */}

                    {/* Error Display */}
                    {uploadError && <p className={styles.error}>{uploadError}</p>}

                    {/* Action Buttons */}
                    <div className={styles.modalActions}>
                        <button type="button" onClick={onClose} disabled={isUploading} className={styles.cancelButton}>
                            Cancel
                        </button>
                        <button type="button" onClick={handleUploadClick} disabled={isUploading} className={styles.confirmButton}>
                            {isUploading ? 'Saving...' : (editingItemPath ? 'Save Metadata' : 'Upload File')}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
    // --- END FIX ---
};

export default MetadataModal; // Ensure default export is present
