import React, { useState, useEffect, useRef } from 'react';
import type { FileMetadata } from '../types';
import baseStyles from '../BasicFileSystem.module.css';
import styles from './MetadataModal.module.css';
import path from 'path-browserify';
// Import react-datepicker
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css'; // Import default CSS
// Import icons for sidebar
import { 
  FaBook, FaLayerGroup, FaLanguage, FaTags, FaClipboardList, 
  FaLock, FaFile, FaGlobe, FaBalanceScale, FaCopyright,
  FaUsers, FaFolderOpen, FaInfoCircle, FaMapMarkerAlt, 
  FaTimesCircle, FaCalendarAlt, FaPen, FaClipboard,
  FaBuilding, FaRegFileCode, FaCodeBranch, FaRocket,
  FaExpandArrowsAlt, FaCompressArrowsAlt // Icons for toggle
} from 'react-icons/fa';
import { fileSystemService } from '../FileSystemService'; // <-- Add this import

// --- Move helper functions to the top, before any usage ---

// Helper function to sanitize path segments
function sanitizePathSegment(segment: string | undefined | null, fallback = '_unknown_'): string {
    if (!segment || typeof segment !== 'string' || segment.trim() === '') {
        return fallback;
    }
    return segment
        .trim()
        .replace(/[\\/:\*\?"<>\|]/g, '_')
        .replace(/\s+/g, '_')
        .replace(/\.+/g, '.');
}

// Format date as YYYYMMDD for filename prefix
function formatDateForFilenamePrefix(date: Date | null): string {
    if (!date) return '';
    try {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}${month}${day}_`;
    } catch (e) {
        console.error("Error formatting date for filename:", date, e);
        return '';
    }
}

// Helper function to safely parse date strings (ensure this exists and handles YYYY-MM-DD)
function parseDateSafe(dateStr: string | undefined | null): Date | null {
    if (!dateStr) return null;
    try {
        if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
            const date = new Date(`${dateStr}T00:00:00Z`);
            return isNaN(date.getTime()) ? null : date;
        } else {
            const date = new Date(dateStr);
            return isNaN(date.getTime()) ? null : date;
        }
    } catch (e) {
        console.warn("Error parsing date string:", dateStr, e);
        return null;
    }
}

// Add this at the top, before the component definition
const defaultMetadataOptions: MetadataOptionsType = {
    // Collections (Step 1)
    collection: [
        "Constitutional_Development", 
        "Truth_and_Reconciliation_Commission", 
        "Judicial_History", 
        "Public_Participation", 
        "Pre-Apartheid_Legal_Systems", 
        "Post-Apartheid_Governance", 
        "Legislative_and_Justice_System_Records"
    ],
    // Jurisdictions (Step 2) - Type options only
    jurisdictionType: [
        "National", 
        "Provincial", 
        "Traditional_Authorities", 
        "International"
    ],
    // Hierarchical jurisdiction names based on type
    jurisdictionName: {
        National: ["South_Africa"],
        Provincial: [
            "Gauteng", 
            "KZN", 
            "Eastern_Cape", 
            "Western_Cape", 
            "Limpopo", 
            "Mpumalanga", 
            "Free_State", 
            "Northern_Cape", 
            "North_West"
        ],
        Traditional_Authorities: [
            "Khoisan_Communities", 
            "Zulu_Kingdom"
        ],
        International: [
            "United_Nations"
        ]
    },
    // Thematic Focus (Step 3) - Primary themes only
    thematicFocusPrimary: [
        "Human_Rights", 
        "Land_Reform", 
        "Transitional_Justice", 
        "Constitutional_Drafting", 
        "Security_Laws"
    ],
    // Hierarchical subthemes based on primary theme
    thematicFocusSubthemes: {
        Human_Rights: [
            "Bill_of_Rights", 
            "Socio-Economic_Rights", 
            "LGBTQ+_Protections"
        ],
        Land_Reform: [
            "Expropriation", 
            "Restitution", 
            "Section_25"
        ],
        Transitional_Justice: [
            "TRC_Testimonies", 
            "Amnesty_Hearings", 
            "Reparations"
        ],
        Constitutional_Drafting: [
            "Multi-Party_Negotiations", 
            "Public_Consultations", 
            "Finalization_Stages"
        ],
        Security_Laws: [
            "RICA", 
            "State_Surveillance"
        ]
    },
    // Issuing Authority (Step 4) - Types
    issuingAuthorityType: [
        "Political_Parties",
        "Government_Bodies",
        "Independent_Commissions",
        "Civil_Society_Organizations",
        "Individuals",
        // Consider adding an "Other" type for manual entry if needed broadly
    ],
    // Hierarchical Issuing Authority Names based on type
    issuingAuthorityName: {
        Political_Parties: [
            "ANC", "DA", "EFF", "IFP", "NFP"
        ],
        Government_Bodies: [
            "Constitutional_Court", "Parliament", "Department_of_Justice", "Department_of_Land_Affairs"
        ],
        Independent_Commissions: [
            "TRC", "Electoral_Commission", "Human_Rights_Commission", "Public_Protector_Office"
        ],
        Civil_Society_Organizations: [
            "COSATU", "Section27", "Law_Review_Project", "Legal_Resource_Centre"
        ],
        Individuals: [
            "Albie_Sachs", "Desmond_Tutu", "Nelson_Mandela", "Dullah_Omar"
        ],
        // Other: []
    },
    // Document Function (Step 5) - Updated options
    documentFunction: [
        "bill-draft",
        "legal-revision",
        "public-submission",
        "consultation-record",
        "parliamentary-debate",
        "commission-report",
        "government-gazette",
        "amendment-bill",
        "official-translation",
        "Court_Judgement",
        "Treaty_Agreement",
        "Act",
        "Research_Paper"
    ],
    // Version (Step 6)
    version: [
        "v0_Preliminary", 
        "v1_internal_review", 
        "v2_Public_Feedback", 
        "v3_Revised_Draft", 
        "v4_Final_Draft"
    ],
    // Workflow Stage (Step 7) - Primary Stages
    workflowStagePrimary: [
        "Creation",
        "Approval",
        "Post-Approval"
    ],
    // Hierarchical Workflow Sub-Stages based on primary stage
    workflowStageSub: {
        Creation: [
            "Draft",
            "Submitted",
            "Under_Review",
            "public-comment",
            "committee-debate"
        ],
        Approval: [
            "Committee_Approved",
            "Certified",
            "Enacted"
        ],
        Post_Approval: [
            "Archived",
            "Repealed",
            "Superseded"
        ]
    },
    // Other fields remain the same
    language: ["en", "fr", "af", "zu", "xh", "ts", "st", "ve", "tn", "ss", "nr", "nso"],
    accessLevel: ["public", "restricted", "admin-only"],
    fileType: ["pdf", "docx", "txt", "jpeg", "png", "mp3", "mp4", "wav", "avi"],
    license: [
        "Creative Commons BY-SA", 
        "Creative Commons BY-NC", 
        "Public Domain", 
        "Government Copyright", 
        "All Rights Reserved"
    ],
};

interface MetadataModalProps {
    file: File | null;
    isOpen: boolean;
    onClose: () => void;
    onSave: (metadata: FileMetadata, targetPath: string, isEditing: boolean, file?: File | null) => Promise<any>; 
    currentDirectory: string;
    initialMetadata?: FileMetadata;
    editingItemPath?: string;
}

// Update MetadataOptionsType to correctly represent hierarchical structures
interface MetadataOptionsType {
    [key: string]: string[] | Record<string, string[]>;
}

const MetadataModal: React.FC<MetadataModalProps> = ({
    file,
    isOpen,
    onClose,
    onSave,
    currentDirectory,
    initialMetadata,
    editingItemPath,
}) => {
    // Ensure originalFileName has a default string value
    const originalFileName = editingItemPath ? path.basename(editingItemPath) : (file?.name || 'unknown_file');
    const [collection, setCollection] = useState('');
    const [jurisdictionType, setJurisdictionType] = useState('');
    const [jurisdictionName, setJurisdictionName] = useState('');
    const [thematicFocusPrimary, setThematicFocusPrimary] = useState('');
    const [thematicFocusSubthemes, setThematicFocusSubthemes] = useState('');
    const [issuingAuthorityType, setIssuingAuthorityType] = useState('');
    const [issuingAuthorityName, setIssuingAuthorityName] = useState('');
    const [documentFunction, setDocumentFunction] = useState('');
    const [version, setVersion] = useState('');
    const [workflowStagePrimary, setWorkflowStagePrimary] = useState('');
    const [workflowStageSub, setWorkflowStageSub] = useState('');
    const [publicationDate, setPublicationDate] = useState<Date | null>(null);
    const [fileType, setFileType] = useState('');
    const [tags, setTags] = useState('');
    const [language, setLanguage] = useState('');
    const [accessLevel, setAccessLevel] = useState('');
    const [license, setLicense] = useState('');
    const [description, setDescription] = useState('');
    const [finalItemName, setFinalItemName] = useState('');
    const [hasManuallyEditedFilename, setHasManuallyEditedFilename] = useState(false);
    const [targetPath, setTargetPath] = useState('');
    const [documentId, setDocumentId] = useState<string | undefined>(undefined);
    const [isUploading, setIsUploading] = useState(false);
    const [uploadError, setUploadError] = useState<string | null>(null);
    const [activeCategory, setActiveCategory] = useState('collection');
    const [activeField, setActiveField] = useState<string | null>(null);
    const [currentStep, setCurrentStep] = useState(0);
    const [fullPreviewPath, setFullPreviewPath] = useState(''); // State for the full path preview
    const [groupedPathPreview, setGroupedPathPreview] = useState(''); // State for grouped path display
    const [shrunkPathPreview, setShrunkPathPreview] = useState(''); // State for collapsed path display
    const [isPathExpanded, setIsPathExpanded] = useState(false); // State for path expansion toggle
    const isInitialLoadRef = useRef(true); // <-- ADD REF TO TRACK INITIAL LOAD
    const [categories] = useState<any[]>([
        { id: 'collection', title: 'Step 1: Collection', fields: ['collection'] },
        { id: 'jurisdiction', title: 'Step 2: Jurisdiction', fields: ['jurisdictionType', 'jurisdictionName'] },
        { id: 'thematicFocus', title: 'Step 3: Thematic Focus', fields: ['thematicFocusPrimary', 'thematicFocusSubthemes'] },
        { id: 'issuingAuthority', title: 'Step 4: Issuing Authority', fields: ['issuingAuthorityType', 'issuingAuthorityName'] },
        { id: 'documentFunction', title: 'Step 5: Document Function', fields: ['documentFunction'] },
        { id: 'version', title: 'Step 6: Version', fields: ['version'] },
        { id: 'workflowStage', title: 'Step 7: Workflow Stage', fields: ['workflowStagePrimary', 'workflowStageSub'] },
        { id: 'item', title: 'Step 8: Item Details', fields: ['publicationDate', 'fileType', 'license', 'accessLevel', 'language', 'finalItemName'] },
        { id: 'additionalMetadata', title: 'Step 9: Additional Metadata', fields: ['tags', 'description'] },
        { id: 'confirmation', title: 'Step 10: Confirmation', fields: [] }, // <-- Step 10 added
    ]);
    const [fieldsConfig, setFieldsConfig] = useState<Record<string, any>>({});
    const [metadataOptions] = useState<Record<string, any>>(defaultMetadataOptions);

    // Function to calculate the DIRECTORY path
    const calculatePredictedPath = () => {
         if (editingItemPath) {
            return path.dirname(editingItemPath).replace(/\\/g, '/'); 
        }
        const pathSegments = [
            sanitizePathSegment(collection, '_collection_'),
            sanitizePathSegment(jurisdictionType + '_' + jurisdictionName, '_jurisdiction_'), 
            sanitizePathSegment(thematicFocusPrimary, '_thematic_focus_'),
            sanitizePathSegment(issuingAuthorityType, '_issuing_authority_'), 
            sanitizePathSegment(documentFunction, '_document_function_'),
            sanitizePathSegment(version, '_version_'),
            sanitizePathSegment(workflowStagePrimary, '_workflow_stage_'), 
        ];
        const dirPath = pathSegments.filter(Boolean).join('/'); 
        return dirPath;
    };

    // Function to calculate the default final filename
    const calculateDefaultFilename = (pubDate: Date | null, origName: string): string => {
        // Add check for origName being potentially empty or invalid before using path functions
        if (!origName) {
            return 'unknown_document'; // Or some other default
        }
        const fileExt = path.extname(origName);
        // Provide fallback for basename if origName is invalid
        const baseName = path.basename(origName || 'unknown_file', fileExt === origName ? undefined : fileExt); 
        const cleanedFileName = sanitizePathSegment(baseName, 'unknown_document');
        const datePrefix = formatDateForFilenamePrefix(pubDate); // Use updated helper
        return `${datePrefix}${cleanedFileName}${fileExt}`;
    };

    // Initialize form data - SIMPLIFIED
    useEffect(() => {
        console.log("[MetadataModal Init Effect] Running. isOpen:", isOpen);
        if (!isOpen) {
            isInitialLoadRef.current = true; // Reset ref when closing
            console.log("[MetadataModal Init Effect] Modal closed, resetting initial load ref.");
            return; // Exit early if not open
        }

        // Set ref to true at the beginning of the open process
        isInitialLoadRef.current = true;
        console.log("[MetadataModal Init Effect] Modal opened, isInitialLoadRef set to true.");
        console.log("[MetadataModal Init Effect] Received initialMetadata:", JSON.stringify(initialMetadata, null, 2));
        console.log("[MetadataModal Init Effect] Received editingItemPath:", editingItemPath);

        const currentOriginalFileName = editingItemPath ? path.basename(editingItemPath) : (file?.name || 'unknown_file');
        console.log(`[MetadataModal Init Effect] Determined original filename: ${currentOriginalFileName}`);

        // Reset fields before applying initial data
        resetFormFields();
        console.log("[MetadataModal Init Effect] State reset complete.");

        if (initialMetadata) {
            console.log("[MetadataModal Init Effect] Processing initialMetadata...");

            // --- Use temporary variables to avoid potential stale state issues ---
            let tempCollection = '';
            let tempJurisdictionType = '';
            let tempJurisdictionName = '';
            let tempThematicFocusPrimary = '';
            let tempThematicFocusSubthemes = ''; // Store as string for input
            let tempIssuingAuthorityType = '';
            let tempIssuingAuthorityName = '';
            let tempDocumentFunction = '';
            let tempVersion = '';
            let tempWorkflowStagePrimary = '';
            let tempWorkflowStageSub = '';
            let tempPublicationDate: Date | null = null;
            let tempFileType = '';
            let tempTags = ''; // Store as string for input
            let tempLanguage = '';
            let tempAccessLevel = '';
            let tempLicense = '';
            let tempDescription = '';
            let tempFinalItemName = '';
            let tempHasManuallyEditedFilename = false;
            let tempDocumentId = initialMetadata?.documentId;

            // --- Extract top-level fields --- Use optional chaining
            tempLanguage = initialMetadata?.language || '';
            tempAccessLevel = initialMetadata?.accessLevel || '';
            tempLicense = initialMetadata?.license || '';
            tempDescription = initialMetadata?.description || initialMetadata?.contentSummary || '';
            // Tags: Ensure it's an array from parser, then join - Use optional chaining
            const tagsArray = Array.isArray(initialMetadata?.tags) ? initialMetadata.tags : [];
            tempTags = tagsArray.join(', ');
            // Initial fileType from top-level (may be overridden) - Use optional chaining
            tempFileType = initialMetadata?.fileType || '';

            // --- Extract structuredPath fields --- Use optional chaining
            const sp = initialMetadata?.structuredPath;
            if (sp) {
                console.log("[MetadataModal Init Effect] Processing structuredPath...");
                tempCollection = sp.collection || '';
                tempJurisdictionType = sp.jurisdiction?.type || '';
                tempJurisdictionName = sp.jurisdiction?.name || '';
                tempThematicFocusPrimary = sp.thematicFocus?.primary || '';

                // Subthemes: Ensure it's an array from parser, then join - Use optional chaining
                const subthemesArray = Array.isArray(sp.thematicFocus?.subthemes) ? sp.thematicFocus.subthemes : [];
                tempThematicFocusSubthemes = subthemesArray.join(', ');
                console.log(`[MetadataModal Init Effect] Extracted Subthemes (as string): "${tempThematicFocusSubthemes}" from array: [${subthemesArray.join(', ')}]`);

                tempIssuingAuthorityType = sp.issuingAuthority?.type || '';
                // Name should be a string from the parser, even for Individuals - Use optional chaining
                tempIssuingAuthorityName = sp.issuingAuthority?.name || '';

                tempDocumentFunction = sp.documentFunction || '';
                tempVersion = sp.version || '';
                tempWorkflowStagePrimary = sp.workflowStage?.primary || '';
                tempWorkflowStageSub = sp.workflowStage?.sub || '';

                // --- ADD LOGGING FOR EXTRACTED VALUES ---
                console.log(`[MetadataModal Init Effect Extract] tempCollection: "${tempCollection}"`);
                console.log(`[MetadataModal Init Effect Extract] tempJurisdictionType: "${tempJurisdictionType}"`);
                console.log(`[MetadataModal Init Effect Extract] tempJurisdictionName: "${tempJurisdictionName}"`);
                console.log(`[MetadataModal Init Effect Extract] tempThematicFocusPrimary: "${tempThematicFocusPrimary}"`);
                console.log(`[MetadataModal Init Effect Extract] tempIssuingAuthorityType: "${tempIssuingAuthorityType}"`);
                console.log(`[MetadataModal Init Effect Extract] tempIssuingAuthorityName: "${tempIssuingAuthorityName}"`);
                console.log(`[MetadataModal Init Effect Extract] tempDocumentFunction: "${tempDocumentFunction}"`);
                console.log(`[MetadataModal Init Effect Extract] tempVersion: "${tempVersion}"`);
                console.log(`[MetadataModal Init Effect Extract] tempWorkflowStagePrimary: "${tempWorkflowStagePrimary}"`);
                console.log(`[MetadataModal Init Effect Extract] tempWorkflowStageSub: "${tempWorkflowStageSub}"`);
                // --- END LOGGING ---

                // --- Extract item details --- Use optional chaining
                const itemDetails = sp.item;
                if (itemDetails) {
                    console.log("[MetadataModal Init Effect] Processing itemDetails...");
                    tempPublicationDate = parseDateSafe(itemDetails.publicationDate); // Use helper
                    // Override fileType if item-specific one exists and is valid - Use optional chaining
                    if (itemDetails.fileType) {
                        tempFileType = itemDetails.fileType; // Already checked itemDetails exists
                    }
                    // Determine filename: Use actual path name if editing, otherwise use metadata or generate
                    if (editingItemPath) {
                        tempFinalItemName = path.basename(editingItemPath); // editingItemPath is checked earlier
                        tempHasManuallyEditedFilename = true; // Assume edited if path exists
                        if (itemDetails.finalItemName && itemDetails.finalItemName !== tempFinalItemName) {
                             console.warn(`[MetadataModal Init Effect] Filename mismatch: Metadata (${itemDetails.finalItemName}) vs Path (${tempFinalItemName}). Using path filename.`);
                        }
                    } else {
                        // Use finalItemName from metadata if present, otherwise calculate default - Use optional chaining
                        tempFinalItemName = itemDetails.finalItemName || calculateDefaultFilename(tempPublicationDate, currentOriginalFileName);
                        tempHasManuallyEditedFilename = !!itemDetails.finalItemName; // True if loaded from metadata
                    }
                } else {
                    // No item details: Generate filename based on context
                    console.log("[MetadataModal Init Effect] No itemDetails found.");
                    if (editingItemPath) {
                        tempFinalItemName = path.basename(editingItemPath); // editingItemPath checked earlier
                        tempHasManuallyEditedFilename = true;
                    } else {
                        tempFinalItemName = calculateDefaultFilename(null, currentOriginalFileName); // No date available
                        tempHasManuallyEditedFilename = false;
                    }
                }
            } else {
                // No structuredPath: Generate filename based on context
                console.warn("[MetadataModal Init Effect] initialMetadata is missing structuredPath.");
                 if (editingItemPath) {
                    tempFinalItemName = path.basename(editingItemPath); // editingItemPath checked earlier
                    tempHasManuallyEditedFilename = true;
                 } else {
                    tempFinalItemName = calculateDefaultFilename(null, currentOriginalFileName); // No date available
                    tempHasManuallyEditedFilename = false;
                 }
                 // Use top-level fileType if structuredPath was missing - Use optional chaining
                 tempFileType = initialMetadata?.fileType || '';
            }

            // Final fileType fallback if still not set
            if (!tempFileType) {
                 // Use optional chaining for file?.name
                 const fallbackExt = editingItemPath ? path.extname(editingItemPath).replace('.', '') : (file?.name ? path.extname(file.name).replace('.', '') : '');
                 tempFileType = fallbackExt;
                 console.log(`[MetadataModal Init Effect] Applied final fileType fallback: "${tempFileType}"`);
            }

            // --- Set state variables from temporary values ---
            console.log("[MetadataModal Init Effect] Setting state variables...");
            setDocumentId(tempDocumentId); console.log(` -> Set DocumentId state to: ${tempDocumentId}`);
            setCollection(tempCollection); console.log(` -> Set Collection state to: ${tempCollection}`);
            setJurisdictionType(tempJurisdictionType); console.log(` -> Set JurisdictionType state to: ${tempJurisdictionType}`);
            setJurisdictionName(tempJurisdictionName); console.log(` -> Set JurisdictionName state to: ${tempJurisdictionName}`);
            setThematicFocusPrimary(tempThematicFocusPrimary); console.log(` -> Set ThematicFocusPrimary state to: ${tempThematicFocusPrimary}`);
            setThematicFocusSubthemes(tempThematicFocusSubthemes); console.log(` -> Set ThematicFocusSubthemes (string state) to: ${tempThematicFocusSubthemes}`);
            setIssuingAuthorityType(tempIssuingAuthorityType); console.log(` -> Set IssuingAuthorityType state to: ${tempIssuingAuthorityType}`);
            setIssuingAuthorityName(tempIssuingAuthorityName); console.log(` -> Set IssuingAuthorityName state to: ${tempIssuingAuthorityName}`);
            setDocumentFunction(tempDocumentFunction); console.log(` -> Set DocumentFunction state to: ${tempDocumentFunction}`);
            setVersion(tempVersion); console.log(` -> Set Version state to: ${tempVersion}`);
            setWorkflowStagePrimary(tempWorkflowStagePrimary); console.log(` -> Set WorkflowStagePrimary state to: ${tempWorkflowStagePrimary}`);
            setWorkflowStageSub(tempWorkflowStageSub); console.log(` -> Set WorkflowStageSub state to: ${tempWorkflowStageSub}`);
            setPublicationDate(tempPublicationDate); console.log(` -> Set PublicationDate state to: ${tempPublicationDate?.toISOString() || 'null'}`);
            setFileType(tempFileType); console.log(` -> Set FileType state to: ${tempFileType}`);
            setTags(tempTags); console.log(` -> Set Tags (string state) to: ${tempTags}`);
            setLanguage(tempLanguage); console.log(` -> Set Language state to: ${tempLanguage}`);
            setAccessLevel(tempAccessLevel); console.log(` -> Set AccessLevel state to: ${tempAccessLevel}`);
            setLicense(tempLicense); console.log(` -> Set License state to: ${tempLicense}`);
            setDescription(tempDescription); console.log(` -> Set Description state to: ${tempDescription}`);
            setFinalItemName(tempFinalItemName); console.log(` -> Set FinalItemName state to: ${tempFinalItemName}`);
            setHasManuallyEditedFilename(tempHasManuallyEditedFilename); console.log(` -> Set HasManuallyEditedFilename state to: ${tempHasManuallyEditedFilename}`);

        } else {
            // --- No initial metadata (new upload) ---
            console.log("[MetadataModal Init Effect] No initialMetadata provided (new upload).");
            setHasManuallyEditedFilename(false);
            let newUploadFilename = '';
            let newUploadFileType = '';
            if (file) { // Check if file exists
                newUploadFileType = path.extname(file.name).replace('.', '');
                newUploadFilename = calculateDefaultFilename(null, file.name);
            } else {
                newUploadFilename = calculateDefaultFilename(null, currentOriginalFileName); // Fallback
            }
            setFileType(newUploadFileType); console.log(` -> Set FileType state (new) to: ${newUploadFileType}`);
            setFinalItemName(newUploadFilename); console.log(` -> Set FinalItemName state (new) to: ${newUploadFilename}`);
            // setAccessLevel('public'); // Example default
        }

        // Calculate target path AFTER state updates are likely processed
        // Set initial path based on editing context
        if (editingItemPath) {
            const initialDirPath = path.dirname(editingItemPath).replace(/\\/g, '/');
            setTargetPath(initialDirPath);
            console.log(`[MetadataModal Init Effect] Set initial TargetPath state (editing) to: "${initialDirPath}"`);
        } else {
             setTargetPath(''); // Start empty for new uploads
             console.log(`[MetadataModal Init Effect] Initial TargetPath state (new upload) set to empty.`);
        }

        // Reset upload status and errors
        setUploadError(null);
        setIsUploading(false);
        // Set initial category and step
        setActiveCategory('collection');
        setCurrentStep(0);

        console.log("[MetadataModal Init Effect] Initialization effect complete.");

        // --- Set initial load ref to false AFTER all state updates ---
        // Use a microtask to ensure it runs after the current render cycle completes
        queueMicrotask(() => {
             isInitialLoadRef.current = false;
             console.log("[MetadataModal Init Effect] isInitialLoadRef set to false (after microtask).");
        });

    }, [initialMetadata, editingItemPath, isOpen, file]); // Dependencies for initialization

    // Reset all form fields
    const resetFormFields = () => {
        console.log("[MetadataModal Reset] Resetting form fields...");
        setCollection('');
        setJurisdictionType('');
        setJurisdictionName('');
        setThematicFocusPrimary('');
        setThematicFocusSubthemes(''); // Reset string state
        setIssuingAuthorityType('');
        setIssuingAuthorityName('');
        setDocumentFunction('');
        setVersion('');
        setWorkflowStagePrimary('');
        setWorkflowStageSub('');
        setPublicationDate(null); 
        setFileType('');
        setTags(''); // Reset string state
        setLanguage('');
        setAccessLevel('');
        setLicense('');
        setDescription('');
        setDocumentId(undefined);
        setFinalItemName(''); 
        setHasManuallyEditedFilename(false);
        setTargetPath(''); // Reset target path as well
        setUploadError(null);
        setIsUploading(false);
        setActiveCategory('collection');
        setCurrentStep(0);
        console.log("[MetadataModal Reset] Reset complete.");
    };

    // Update directory path when metadata changes (for NEW uploads)
    useEffect(() => {
        // --- ADD CHECK: Only run if not initial load ---
        if (isInitialLoadRef.current) {
            console.log("[Path Update Effect] Skipping during initial load.");
            return;
        }
        // Only calculate path dynamically for new uploads
        if (!editingItemPath) { 
            const newPath = calculatePredictedPath();
            // Only update if the path actually changes to avoid potential loops
            if (newPath !== targetPath) { 
                console.log(`[Path Update Effect] New predicted path: ${newPath}`);
                setTargetPath(newPath);
            }
        }
        // Intentionally NOT including targetPath in dependencies here
    }, [ 
        collection, jurisdictionType, jurisdictionName, thematicFocusPrimary, 
        issuingAuthorityType, documentFunction, version, workflowStagePrimary, 
        editingItemPath // Include editingItemPath to ensure this effect respects edit mode
    ]);

    // Update default filename when relevant fields change, unless manually edited (for NEW uploads)
    useEffect(() => {
        // --- ADD CHECK: Only run if not initial load ---
        if (isInitialLoadRef.current) {
            console.log("[Filename Update Effect] Skipping during initial load.");
            return;
        }
        if (!hasManuallyEditedFilename && !editingItemPath) { 
            const newDefaultFilename = calculateDefaultFilename(publicationDate, originalFileName);
            // Only update if it actually changes
            if (newDefaultFilename !== finalItemName) {
                console.log(`[Filename Update Effect] Setting new default filename: ${newDefaultFilename}`);
                setFinalItemName(newDefaultFilename);
            }
        }
    }, [publicationDate, originalFileName, hasManuallyEditedFilename, editingItemPath, finalItemName]); // Added finalItemName to prevent loops if calculation result is same

    // Update the full, grouped (expanded), and shrunk preview paths
    useEffect(() => {
        const currentFinalName = finalItemName || calculateDefaultFilename(publicationDate, originalFileName);
        const dirPath = targetPath || '/';
        const fullPath = path.join(dirPath, currentFinalName).replace(/\\/g, '/');
        const finalFullPath = fullPath.startsWith('/') ? fullPath : '/' + fullPath;
        setFullPreviewPath(finalFullPath);

        const segments = finalFullPath.split('/').filter(Boolean); // Split and remove empty segments

        // Create grouped path preview (expanded view - pairs per line)
        let groupedPath = '';
        for (let i = 0; i < segments.length; i += 2) {
            if (i + 1 < segments.length) {
                // Pair of segments
                groupedPath += `/${segments[i]}/${segments[i + 1]}`;
            } else {
                // Last single segment (usually the filename)
                groupedPath += `/${segments[i]}`;
            }
            if (i + 2 < segments.length) {
                groupedPath += '\n'; // Add newline if not the last pair/segment
            }
        }
        setGroupedPathPreview(groupedPath);

        // Create shrunk path preview (collapsed view - /first/last)
        let shrunkPath = '';
        if (segments.length > 1) {
            shrunkPath = `/${segments[0]}/.../${segments[segments.length - 1]}`; // Add ellipsis for clarity
        } else if (segments.length === 1) {
            shrunkPath = `/${segments[0]}`; // Only one segment (e.g., just filename in root)
        }
        setShrunkPathPreview(shrunkPath);


    }, [targetPath, finalItemName, publicationDate, originalFileName]);

    // Handle manual filename edit
    const handleFilenameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setFinalItemName(e.target.value);
        setHasManuallyEditedFilename(true); 
    };

    // Handle save
    const handleSaveClick = async () => {
        // Provide fallback for publicationDate and originalFileName if needed
        const currentFinalItemName = finalItemName || calculateDefaultFilename(publicationDate, originalFileName || 'unknown_file');
        // Convert comma-separated strings back to arrays for saving
        const subthemesArray = thematicFocusSubthemes.split(',').map((t: string) => t.trim()).filter((t: string) => t);
        const tagsArray = tags.split(',').map((t: string) => t.trim()).filter((t: string) => t);

        const metadata: FileMetadata = {
            documentId: documentId,
            structuredPath: {
                 collection: collection || undefined,
                jurisdiction: { type: jurisdictionType || undefined, name: jurisdictionName || undefined },
                thematicFocus: { primary: thematicFocusPrimary || undefined, subthemes: subthemesArray.length > 0 ? subthemesArray : undefined }, // Save as array
                issuingAuthority: { type: issuingAuthorityType || undefined, name: issuingAuthorityName || undefined }, // Name is already string
                documentFunction: documentFunction || undefined,
                version: version || undefined,
                workflowStage: { primary: workflowStagePrimary || undefined, sub: workflowStageSub || undefined },
                item: {
                    fileName: originalFileName || undefined,
                    // Provide fallback for path.basename and ensure date prefix is handled
                    cleanedFileName: path.basename(currentFinalItemName || 'unknown_file', path.extname(currentFinalItemName || 'unknown_file')).replace(formatDateForFilenamePrefix(publicationDate), '') || undefined,
                    finalItemName: currentFinalItemName || undefined,
                    fileType: fileType || undefined,
                    publicationDate: publicationDate ? publicationDate.toISOString().split('T')[0] : undefined
                }
            },
             language: language || undefined,
            tags: tagsArray.length > 0 ? tagsArray : undefined, // Save as array
            accessLevel: accessLevel || undefined,
            fileType: fileType || undefined, // Top-level fileType (often same as item.fileType)
            license: license || undefined,
            description: description || undefined,
            contentSummary: description || undefined // Often same as description
        };

        const isEditing = !!editingItemPath;

        // Validation (ensure all required fields are checked)
        if (!isEditing && !file) { setUploadError("No file selected for upload."); return; }
        if (!collection) { setUploadError("Collection is required."); setActiveCategory('collection'); setCurrentStep(0); return; }
        if (!jurisdictionType || !jurisdictionName) { setUploadError("Jurisdiction type and name are required."); setActiveCategory('jurisdiction'); setCurrentStep(1); return; }
        if (!thematicFocusPrimary) { setUploadError("Primary Theme is required."); setActiveCategory('thematicFocus'); setCurrentStep(categories.findIndex(c => c.id === 'thematicFocus')); return; }
        if (!issuingAuthorityType || !issuingAuthorityName) { setUploadError("Issuing authority type and name are required."); setActiveCategory('issuingAuthority'); setCurrentStep(categories.findIndex(c => c.id === 'issuingAuthority')); return; }
        if (!documentFunction) { setUploadError("Document Function is required."); setActiveCategory('documentFunction'); setCurrentStep(categories.findIndex(c => c.id === 'documentFunction')); return; }
        if (!version) { setUploadError("Version is required."); setActiveCategory('version'); setCurrentStep(categories.findIndex(c => c.id === 'version')); return; }
        if (!workflowStagePrimary || !workflowStageSub) { setUploadError("Workflow primary stage and sub-stage are required."); setActiveCategory('workflowStage'); setCurrentStep(categories.findIndex(c => c.id === 'workflowStage')); return; }
        if (!publicationDate) { setUploadError("Publication date is required."); setActiveCategory('item'); setCurrentStep(categories.findIndex(c => c.id === 'item')); return; }
        if (!fileType) { setUploadError("File type is required."); setActiveCategory('item'); setCurrentStep(categories.findIndex(c => c.id === 'item')); return; }
        if (!accessLevel) { setUploadError("Access Level is required."); setActiveCategory('item'); setCurrentStep(categories.findIndex(c => c.id === 'item')); return; }
        if (!license) { setUploadError("License is required."); setActiveCategory('item'); setCurrentStep(categories.findIndex(c => c.id === 'item')); return; }
        if (!currentFinalItemName || currentFinalItemName.trim() === '') { setUploadError("Final filename cannot be empty."); setActiveCategory('item'); setCurrentStep(categories.findIndex(c => c.id === 'item')); return; }
        if (/[\\/:\*\?"<>\|]/.test(currentFinalItemName)) { setUploadError("Final filename contains invalid characters (\\ / : * ? \" < > |)."); setActiveCategory('item'); setCurrentStep(categories.findIndex(c => c.id === 'item')); return; }

        const finalDirectoryPath = targetPath.replace(/\\/g, '/');
        // Ensure fullTargetPathForSave correctly joins the directory and filename
        const fullTargetPathForSave = path.join(finalDirectoryPath || '/', currentFinalItemName).replace(/\\/g, '/'); 

        console.log(`[MetadataModal] Saving metadata:`, metadata);
        console.log(`[MetadataModal] Target directory path: ${finalDirectoryPath}`);
        console.log(`[MetadataModal] Full target path for save: ${fullTargetPathForSave}`);

        setIsUploading(true);
        setUploadError(null);
        try {
            await onSave(metadata, fullTargetPathForSave, isEditing, file); 
        } catch (error: any) {
            console.error("Save error in modal:", error);
            setUploadError(error.message || "An unknown error occurred during save.");
        } finally {
            setIsUploading(false);
        }
    };

    // UI navigation functions
    const handleCategorySelect = (categoryId: string) => {
        setActiveCategory(categoryId);
        const category = categories.find(c => c.id === categoryId);
        if (category && category.fields.length > 0) { setActiveField(category.fields[0]); } 
        else { setActiveField(null); }
    };
    const handleNextStep = () => {
        if (currentStep < categories.length - 1) {
            setCurrentStep(currentStep + 1);
            setActiveCategory(categories[currentStep + 1].id);
        }
    };
    const handlePrevStep = () => {
        if (currentStep > 0) {
            setCurrentStep(currentStep - 1);
            setActiveCategory(categories[currentStep - 1].id);
        }
    };

    // When category is changed via sidebar, update current step
    useEffect(() => {
        const stepIndex = categories.findIndex(cat => cat.id === activeCategory);
        if (stepIndex !== -1) { setCurrentStep(stepIndex); }
    }, [activeCategory]);

    // Get the icon for a field
    const getFieldIcon = (fieldName: string) => {
         switch(fieldName) {
            case 'collection': return <FaFolderOpen className={styles.categoryIcon} />;
            case 'jurisdictionType': case 'jurisdictionName': return <FaGlobe className={styles.categoryIcon} />;
            case 'thematicFocusPrimary': case 'thematicFocusSubthemes': return <FaBook className={styles.categoryIcon} />;
            case 'issuingAuthorityType': case 'issuingAuthorityName': return <FaBuilding className={styles.categoryIcon} />;
            case 'documentFunction': return <FaRegFileCode className={styles.categoryIcon} />;
            case 'version': return <FaCodeBranch className={styles.categoryIcon} />;
            case 'workflowStagePrimary': case 'workflowStageSub': return <FaRocket className={styles.categoryIcon} />;
            case 'publicationDate': return <FaCalendarAlt className={styles.categoryIcon} />;
            case 'fileType': return <FaFile className={styles.categoryIcon} />;
            case 'tags': return <FaTags className={styles.categoryIcon} />;
            case 'language': return <FaLanguage className={styles.categoryIcon} />;
            case 'accessLevel': return <FaLock className={styles.categoryIcon} />;
            case 'license': return <FaCopyright className={styles.categoryIcon} />;
            case 'description': return <FaInfoCircle className={styles.categoryIcon} />;
            case 'finalItemName': return <FaPen className={styles.categoryIcon} />; // Icon for filename
            default: return <FaInfoCircle className={styles.categoryIcon} />;
        }
    };

    // Get field label
    const getFieldLabel = (fieldName: string): string => {
         switch(fieldName) {
            case 'collection': return 'Collection';
            case 'jurisdictionType': return 'Jurisdiction Type';
            case 'jurisdictionName': return 'Jurisdiction Name';
            case 'thematicFocusPrimary': return 'Primary Theme';
            case 'thematicFocusSubthemes': return 'Subthemes';
            case 'issuingAuthorityType': return 'Authority Type';
            case 'issuingAuthorityName': return 'Authority Name';
            case 'documentFunction': return 'Document Function';
            case 'version': return 'Version';
            case 'workflowStagePrimary': return 'Workflow Stage';
            case 'workflowStageSub': return 'Workflow Sub-Stage';
            case 'publicationDate': return 'Publication Date';
            case 'fileType': return 'File Type';
            case 'tags': return 'Tags';
            case 'language': return 'Language';
            case 'accessLevel': return 'Access Level';
            case 'license': return 'License';
            case 'description': return 'Description';
            case 'finalItemName': return 'Final Filename'; // Label for filename
            default: return fieldName.charAt(0).toUpperCase() + fieldName.slice(1);
        }
    };

    // Get available jurisdiction names based on selected type
    const getAvailableJurisdictionNames = (): string[] => {
        if (!jurisdictionType || typeof metadataOptions.jurisdictionName !== 'object') { return []; }
        const jurisdictionNameOptions = metadataOptions.jurisdictionName as { [key: string]: string[] };
        return jurisdictionNameOptions[jurisdictionType] || [];
    };

    // Get available subthemes based on selected primary theme
    const getAvailableSubthemes = (): string[] => {
        if (!thematicFocusPrimary || typeof metadataOptions.thematicFocusSubthemes !== 'object') { return []; }
        const subthemeOptions = metadataOptions.thematicFocusSubthemes as { [key: string]: string[] };
        return subthemeOptions[thematicFocusPrimary] || [];
    };

    // Add helper for Issuing Authority Names
    const getAvailableIssuingAuthorityNames = (): string[] => {
        if (!issuingAuthorityType || typeof metadataOptions.issuingAuthorityName !== 'object') { return []; }
        const authorityNameOptions = metadataOptions.issuingAuthorityName as Record<string, string[]>;
        return authorityNameOptions[issuingAuthorityType] || [];
    };

    // Add helper for Workflow Sub-Stages
    const getAvailableWorkflowSubStages = (): string[] => {
        if (!workflowStagePrimary || typeof metadataOptions.workflowStageSub !== 'object') { return []; }
        const subStageOptions = metadataOptions.workflowStageSub as Record<string, string[]>;
        const primaryKey = Object.keys(subStageOptions).find(key => key.replace(/[-_]/g, '') === workflowStagePrimary.replace(/[-_]/g, '')) || workflowStagePrimary;
        return subStageOptions[primaryKey] || [];
    };

    // Reset dependent fields when parent field changes - ADD isInitialLoadRef CHECK
    useEffect(() => {
        if (isInitialLoadRef.current) { // <-- CHECK REF
            console.log("[Dependent Effect - JurisdictionName] Skipping reset during initial load.");
            return;
        }
        console.log(`[Dependent Effect - JurisdictionName] Triggered. Type: "${jurisdictionType}", Current Name: "${jurisdictionName}"`); // ADD LOG
        if (jurisdictionType) {
            const availableNames = getAvailableJurisdictionNames();
            console.log(`[Dependent Effect - JurisdictionName] Available names for "${jurisdictionType}":`, availableNames); // ADD LOG
            if (jurisdictionName && !availableNames.includes(jurisdictionName)) {
                console.log(`[Dependent Effect - JurisdictionName] Resetting Name because "${jurisdictionName}" is not in available list.`); // ADD LOG
                setJurisdictionName('');
            } else {
                 console.log(`[Dependent Effect - JurisdictionName] Name "${jurisdictionName}" is valid or empty. No reset needed.`); // ADD LOG
            }
        } else {
             console.log(`[Dependent Effect - JurisdictionName] Resetting Name because Type is empty.`); // ADD LOG
             setJurisdictionName('');
        }
    }, [jurisdictionType]); // Keep dependencies minimal

    useEffect(() => {
        if (isInitialLoadRef.current) { // <-- CHECK REF
            console.log("[Dependent Effect - Subthemes] Skipping reset/filter during initial load.");
            return;
        }
        console.log(`[Dependent Effect - Subthemes] Triggered. Primary: "${thematicFocusPrimary}", Current Subthemes: "${thematicFocusSubthemes}"`); // ADD LOG
        if (thematicFocusPrimary) {
            const availableSubthemes = getAvailableSubthemes();
             console.log(`[Dependent Effect - Subthemes] Available subthemes for "${thematicFocusPrimary}":`, availableSubthemes); // ADD LOG
            if (thematicFocusSubthemes) {
                const currentSubthemes = thematicFocusSubthemes.split(',').map((t: string) => t.trim()).filter((t: string) => t);
                const validSubthemes = currentSubthemes.filter((subtheme: string) => availableSubthemes.includes(subtheme));
                if (validSubthemes.length !== currentSubthemes.length) {
                     console.log(`[Dependent Effect - Subthemes] Resetting/Filtering Subthemes. Original: [${currentSubthemes.join(', ')}], Valid: [${validSubthemes.join(', ')}]`); // ADD LOG
                     setThematicFocusSubthemes(validSubthemes.join(', '));
                } else {
                     console.log(`[Dependent Effect - Subthemes] All current subthemes are valid. No reset needed.`); // ADD LOG
                }
            } else {
                 console.log(`[Dependent Effect - Subthemes] No current subthemes. No reset needed.`); // ADD LOG
            }
        } else {
             console.log(`[Dependent Effect - Subthemes] Resetting Subthemes because Primary is empty.`); // ADD LOG
             setThematicFocusSubthemes('');
        }
    }, [thematicFocusPrimary]); // Keep dependencies minimal

    useEffect(() => {
        if (isInitialLoadRef.current) { // <-- CHECK REF
            console.log("[Dependent Effect - AuthorityName] Skipping reset during initial load.");
            return;
        }
        console.log(`[Dependent Effect - AuthorityName] Triggered. Type: "${issuingAuthorityType}", Current Name: "${issuingAuthorityName}"`); // ADD LOG
        if (issuingAuthorityType) {
            const availableNames = getAvailableIssuingAuthorityNames();
            console.log(`[Dependent Effect - AuthorityName] Available names for "${issuingAuthorityType}":`, availableNames); // ADD LOG
            // Only reset if it's NOT 'Individuals' AND the current name is invalid
            if (issuingAuthorityType !== 'Individuals' && issuingAuthorityName && !availableNames.includes(issuingAuthorityName)) {
                 console.log(`[Dependent Effect - AuthorityName] Resetting Name because "${issuingAuthorityName}" is not in available list for type "${issuingAuthorityType}".`); // ADD LOG
                 setIssuingAuthorityName('');
            }
            // No reset needed if type is 'Individuals' (allows free text) or if name is valid/empty
            else {
                 console.log(`[Dependent Effect - AuthorityName] Name "${issuingAuthorityName}" is valid, empty, or type is Individuals. No reset needed.`); // ADD LOG
            }
        } else {
             console.log(`[Dependent Effect - AuthorityName] Resetting Name because Type is empty.`); // ADD LOG
             setIssuingAuthorityName('');
        }
    }, [issuingAuthorityType]); // Keep dependencies minimal

    useEffect(() => {
        if (isInitialLoadRef.current) { // <-- CHECK REF
            console.log("[Dependent Effect - WorkflowSub] Skipping reset during initial load.");
            return;
        }
        console.log(`[Dependent Effect - WorkflowSub] Triggered. Primary: "${workflowStagePrimary}", Current Sub: "${workflowStageSub}"`); // ADD LOG
        if (workflowStagePrimary) {
            const availableSubs = getAvailableWorkflowSubStages();
            console.log(`[Dependent Effect - WorkflowSub] Available subs for "${workflowStagePrimary}":`, availableSubs); // ADD LOG
            if (workflowStageSub && !availableSubs.includes(workflowStageSub)) {
                 console.log(`[Dependent Effect - WorkflowSub] Resetting Sub because "${workflowStageSub}" is not in available list.`); // ADD LOG
                 setWorkflowStageSub('');
            } else {
                 console.log(`[Dependent Effect - WorkflowSub] Sub "${workflowStageSub}" is valid or empty. No reset needed.`); // ADD LOG
            }
        } else {
             console.log(`[Dependent Effect - WorkflowSub] Resetting Sub because Primary is empty.`); // ADD LOG
             setWorkflowStageSub('');
        }
    }, [workflowStagePrimary]); // Keep dependencies minimal

    // Render the form field
    const renderFormField = (fieldName: string) => {
        let currentValue: any = ''; 
        let setValue: (value: any) => void = () => {};
        let fieldDef = fieldsConfig[fieldName] || {};
        let helperText = fieldDef.description || '';
        let isTextarea = false;
        let isDateInput = false;
        let isReadOnly = false;
        let isCommaInput = false;

        // --- Determine currentValue and setValue based on fieldName ---
        switch(fieldName) {
            // ... (keep all existing cases) ...
            case 'collection': currentValue = collection; setValue = setCollection; helperText = 'High-level archival category for this document'; break;
            case 'jurisdictionType': currentValue = jurisdictionType; setValue = setJurisdictionType; helperText = 'The type of jurisdiction (National, Provincial, etc.)'; break;
            case 'jurisdictionName': currentValue = jurisdictionName; setValue = setJurisdictionName; helperText = 'The specific jurisdiction entity name'; break;
            case 'thematicFocusPrimary': currentValue = thematicFocusPrimary; setValue = setThematicFocusPrimary; helperText = 'The primary theme or subject of the document'; break;
            case 'thematicFocusSubthemes': currentValue = thematicFocusSubthemes; setValue = setThematicFocusSubthemes; isCommaInput = true; helperText = 'Additional themes, selected below or entered manually'; break;
            case 'issuingAuthorityType': currentValue = issuingAuthorityType; setValue = setIssuingAuthorityType; helperText = 'The type of entity that issued the document'; break;
            case 'issuingAuthorityName': currentValue = issuingAuthorityName; setValue = setIssuingAuthorityName; isCommaInput = false; helperText = 'The specific entity or individual name'; break;
            case 'documentFunction': currentValue = documentFunction; setValue = setDocumentFunction; helperText = 'The functional purpose of this document'; break;
            case 'version': currentValue = version; setValue = setVersion; helperText = 'Version or iteration of the document'; break;
            case 'workflowStagePrimary': currentValue = workflowStagePrimary; setValue = setWorkflowStagePrimary; helperText = 'The main stage in the document lifecycle'; break;
            case 'workflowStageSub': currentValue = workflowStageSub; setValue = setWorkflowStageSub; helperText = 'The specific status within the stage'; break;
            case 'publicationDate': currentValue = publicationDate; setValue = setPublicationDate; isDateInput = true; helperText = 'When the document was published'; break;
            case 'fileType': currentValue = fileType; setValue = setFileType; helperText = 'The file format (pdf, docx, etc.)'; break;
            case 'tags': currentValue = tags; setValue = setTags; isCommaInput = true; helperText = 'Keywords for search, separated by commas'; break;
            case 'language': currentValue = language; setValue = setLanguage; helperText = 'The primary language of the document'; break;
            case 'accessLevel': currentValue = accessLevel; setValue = setAccessLevel; helperText = 'Who can access this document'; break;
            case 'license': currentValue = license; setValue = setLicense; helperText = 'Copyright or usage license'; break;
            case 'description': currentValue = description; setValue = setDescription; isTextarea = true; helperText = 'Brief summary of the document contents'; break;
            case 'finalItemName': currentValue = finalItemName; setValue = (val: string) => { setFinalItemName(val); setHasManuallyEditedFilename(true); }; helperText = 'The final name for the file (auto-generated, editable)'; break;
        }

        // --- ADD LOGGING HERE ---
        console.log(`[RenderFormField] Rendering field: '${fieldName}'. Current value used:`, currentValue);
        // --- END LOGGING ---

        // --- Render appropriate input type based on fieldName ---
        if (isDateInput) {
             return (
                <div className={baseStyles.formGroup}>
                    <label htmlFor={fieldName}>{getFieldLabel(fieldName)}:</label>
                    {/* Ensure DatePicker receives the correct 'selected' prop */}
                    <DatePicker id={fieldName} selected={currentValue} onChange={(date: Date | null) => setValue(date)} dateFormat="yyyy-MM-dd" placeholderText="YYYY-MM-DD" className={styles.datePickerInput} disabled={isUploading} showYearDropdown scrollableYearDropdown yearDropdownItemNumber={30} />
                    {helperText && <small>{helperText}</small>}
                </div>
            );
        } else if (fieldDef.type === 'select') {
            const options: string[] = Array.isArray(metadataOptions[fieldName]) ? metadataOptions[fieldName] : [];
            return (
                <div className={baseStyles.formGroup}>
                    <label htmlFor={fieldName}>{fieldDef.label || fieldName}:</label>
                    <select id={fieldName} value={currentValue} onChange={e => setValue(e.target.value)} disabled={isUploading}>
                        <option value="">-- Select --</option>
                        {options.map(opt => (
                            <option key={opt} value={opt}>{opt.replace(/_/g, ' ')}</option>
                        ))}
                    </select>
                    {helperText && <small>{helperText}</small>}
                </div>
            );
        } else if (fieldName === 'finalItemName') {
             return (
                <div className={baseStyles.formGroup}>
                    <label htmlFor={fieldName}>{getFieldLabel(fieldName)}:</label>
                    <input id={fieldName} type="text" value={currentValue} onChange={(e) => setValue(e.target.value)} disabled={isUploading} placeholder="e.g., 20231027_document_title.pdf" />
                     {/* Provide fallback for calculateDefaultFilename */}
                     {hasManuallyEditedFilename && ( <button type="button" onClick={() => { setHasManuallyEditedFilename(false); setFinalItemName(calculateDefaultFilename(publicationDate, originalFileName || 'unknown_file')); }} className={styles.resetFilenameButton} title="Reset to auto-generated name"> Reset Name </button> )}
                    {helperText && <small>{helperText}</small>}
                </div>
            );
        } else if (isCommaInput && fieldName !== 'thematicFocusSubthemes') { // Exclude subthemes from generic comma input rendering
             // Render generic comma input for 'tags'
             return (
                <div className={baseStyles.formGroup}>
                    <label htmlFor={fieldName}>{getFieldLabel(fieldName)}:</label>
                    <div className={styles.inputWithButton}>
                        {/* Ensure input receives the correct 'value' prop */}
                        <input id={fieldName} type="text" value={currentValue} onChange={(e) => setValue(e.target.value)} disabled={isUploading} placeholder={`Enter ${getFieldLabel(fieldName).toLowerCase()}...`} />
                    </div>
                    {helperText && <small>{helperText}</small>}
                    {/* Ensure tag rendering uses the correct 'currentValue' */}
                    {currentValue && (
                        <div className={styles.optionTagsContainer}>
                            {currentValue.split(',').map((t: string) => t.trim()).filter((t: string) => t).map((tag: string, i: number) => ( 
                                <div key={i} className={styles.optionTag}>
                                    {tag}
                                    <button type="button" className={styles.removeTagButton} onClick={() => { const tags = currentValue.split(',').map((t: string) => t.trim()).filter((_: string, idx: number) => idx !== i).join(', '); setValue(tags); }}> 
                                        <FaTimesCircle />
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            );
        } else if (isTextarea) {
             return (
                <div className={baseStyles.formGroup}>
                    <label htmlFor={fieldName}>{getFieldLabel(fieldName)}:</label>
                    {/* Ensure textarea receives the correct 'value' prop */}
                    <textarea id={fieldName} value={currentValue} onChange={(e) => setValue(e.target.value)} disabled={isUploading} rows={4} placeholder={`Enter ${getFieldLabel(fieldName).toLowerCase()}...`} />
                    {helperText && <small>{helperText}</small>}
                </div>
            );
        } else if (fieldName === 'jurisdictionName') {
            console.log(`[RenderFormField Select] Rendering '${fieldName}' with select value prop: "${currentValue}"`);
            return (
                <div className={baseStyles.formGroup}>
                    <label htmlFor={fieldName}>{getFieldLabel(fieldName)}:</label>
                    <select id={fieldName} value={currentValue} onChange={(e) => setValue(e.target.value)} disabled={isUploading || !jurisdictionType}>
                        <option value="">-- Select --</option>
                        {getAvailableJurisdictionNames().map(opt => {
                            // --- ADD OPTION LOG ---
                            console.log(`[RenderFormField Option] Rendering '${fieldName}' option with value: "${opt}"`);
                            // --- END OPTION LOG ---
                            return (<option key={opt} value={opt}>{opt.replace(/_/g, ' ')}</option>);
                        })}
                    </select>
                    {!jurisdictionType && <small>Please select a jurisdiction type first</small>}
                    {helperText && <small>{helperText}</small>}
                </div>
            );
        } else if (fieldName === 'thematicFocusSubthemes') {
             // Specific rendering for subthemes with checkboxes and manual input
             const currentSelectedArray = currentValue.split(',').map((t: string) => t.trim()).filter((t: string) => t);
             // --- ADD SPECIFIC LOG ---
            console.log(`[RenderFormField Checkbox/Input] Rendering '${fieldName}' with currentValue (string): "${currentValue}"`);
            return (
                <div className={baseStyles.formGroup}>
                    <label htmlFor={fieldName}>{getFieldLabel(fieldName)} {thematicFocusPrimary ? `for ${thematicFocusPrimary.replace(/_/g, ' ')}` : ''}:</label>
                    {!thematicFocusPrimary ? ( <div className={styles.selectPrimaryFirst}> Please select a Primary Theme first to see available subthemes. </div> ) : (
                        <div className={styles.subthemeSelectionContainer}>
                            {getAvailableSubthemes().length > 0 ? ( getAvailableSubthemes().map(subtheme => {
                                const isSelected = currentSelectedArray.includes(subtheme); 
                                // --- ADD SPECIFIC LOG ---
                                console.log(`[RenderFormField Checkbox] Rendering subtheme '${subtheme}' with checked prop: ${isSelected}`);
                                // Ensure checkbox receives the correct 'checked' prop
                                return ( <div key={subtheme} className={styles.subthemeCheckbox}> <input type="checkbox" id={`subtheme-${subtheme}`} checked={isSelected} onChange={() => { let newSelection: string[]; if (isSelected) { newSelection = currentSelectedArray.filter((t: string) => t !== subtheme); } else { newSelection = [...currentSelectedArray, subtheme]; } setValue(newSelection.join(', ')); }} disabled={isUploading} /> <label htmlFor={`subtheme-${subtheme}`}>{subtheme.replace(/_/g, ' ')}</label> </div> ); 
                            })) : ( <div className={styles.noSubthemesMessage}> No predefined subthemes for this primary theme. </div> )}
                        </div>
                    )}
                    {/* Allow manual entry as well */}
                     <div className={styles.subthemesTextInput}>
                         <label htmlFor={`${fieldName}-manual`} className={styles.manualEntryLabel}>Or enter manually (comma-separated):</label>
                         {/* Ensure input receives the correct 'value' prop */}
                         <input id={`${fieldName}-manual`} type="text" value={currentValue} onChange={(e) => setValue(e.target.value)} disabled={isUploading} placeholder="e.g., subtheme1, subtheme2" />
                     </div>
                     {/* Ensure tag rendering uses the correct 'currentValue' */}
                    {currentValue && (
                        <div className={styles.selectedSubthemesDisplay}>
                            <span className={styles.selectedSubthemesLabel}>Selected/Entered:</span>
                            <div className={styles.optionTagsContainer}>
                                {currentSelectedArray.map((tag: string, i: number) => ( 
                                    <div key={i} className={styles.optionTag}>
                                        {tag.replace(/_/g, ' ')}
                                        <button type="button" className={styles.removeTagButton} onClick={() => { const tags = currentSelectedArray.filter((_: string, idx: number) => idx !== i).join(', '); setValue(tags); }} disabled={isUploading}> 
                                            <FaTimesCircle />
                                        </button>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                    {helperText && <small>{helperText}</small>}
                </div>
            );
        } else if (fieldName === 'issuingAuthorityType') {
            console.log(`[RenderFormField Select] Rendering '${fieldName}' with select value prop: "${currentValue}"`);
             return (
                <div className={baseStyles.formGroup}>
                    <label htmlFor={fieldName}>{getFieldLabel(fieldName)}:</label>
                    <select id={fieldName} value={currentValue} onChange={(e) => setValue(e.target.value)} disabled={isUploading}>
                        <option value="">-- Select Authority Type --</option>
                        {Array.isArray(metadataOptions[fieldName]) && (metadataOptions[fieldName] as string[]).map((opt: string) => {
                             // --- ADD OPTION LOG ---
                             console.log(`[RenderFormField Option] Rendering '${fieldName}' option with value: "${opt}"`);
                             // --- END OPTION LOG ---
                             return (<option key={opt} value={opt}>{opt.replace(/_/g, ' ')}</option>);
                        })}
                    </select>
                    {helperText && <small>{helperText}</small>}
                </div>
            );
        } else if (fieldName === 'issuingAuthorityName') {
            console.log(`[RenderFormField Select/Input] Rendering '${fieldName}' with value prop: "${currentValue}" (Type: ${issuingAuthorityType})`);
            if (issuingAuthorityType === 'Individuals' || !issuingAuthorityType) {
                 return ( <div className={baseStyles.formGroup}> <label htmlFor={fieldName}>{getFieldLabel(fieldName)}:</label> <input id={fieldName} type="text" value={currentValue} onChange={(e) => setValue(e.target.value)} disabled={isUploading || !issuingAuthorityType} placeholder={issuingAuthorityType === 'Individuals' ? 'Enter Individual\'s Name...' : 'Select Authority Type first...'} /> {!issuingAuthorityType && <small>Please select an authority type first</small>} {helperText && <small>{helperText}</small>} </div> );
            } else {
                return ( <div className={baseStyles.formGroup}> <label htmlFor={fieldName}>{getFieldLabel(fieldName)}:</label> <select id={fieldName} value={currentValue} onChange={(e) => setValue(e.target.value)} disabled={isUploading || !issuingAuthorityType}> <option value="">-- Select Authority Name --</option> {getAvailableIssuingAuthorityNames().map(opt => {
                             // --- ADD OPTION LOG ---
                             console.log(`[RenderFormField Option] Rendering '${fieldName}' option with value: "${opt}"`);
                             // --- END OPTION LOG ---
                             return (<option key={opt} value={opt}>{opt.replace(/_/g, ' ')}</option>);
                        })} </select> {!issuingAuthorityType && <small>Please select an authority type first</small>} {helperText && <small>{helperText}</small>} </div> );
            }
        } else if (fieldName === 'workflowStagePrimary') {
            console.log(`[RenderFormField Select] Rendering '${fieldName}' with select value prop: "${currentValue}"`);
             return (
                <div className={baseStyles.formGroup}>
                    <label htmlFor={fieldName}>{getFieldLabel(fieldName)}:</label>
                    <select id={fieldName} value={currentValue} onChange={(e) => setValue(e.target.value)} disabled={isUploading}>
                        <option value="">-- Select Stage --</option>
                        {Array.isArray(metadataOptions[fieldName]) && (metadataOptions[fieldName] as string[]).map((opt: string) => {
                             // --- ADD OPTION LOG ---
                             console.log(`[RenderFormField Option] Rendering '${fieldName}' option with value: "${opt}"`);
                             // --- END OPTION LOG ---
                             return (<option key={opt} value={opt}>{opt.replace(/_/g, ' ')}</option>);
                        })}
                    </select>
                    {helperText && <small>{helperText}</small>}
                </div>
            );
        } else if (fieldName === 'workflowStageSub') {
            console.log(`[RenderFormField Select] Rendering '${fieldName}' with select value prop: "${currentValue}"`);
             return (
                <div className={baseStyles.formGroup}>
                    <label htmlFor={fieldName}>{getFieldLabel(fieldName)}:</label>
                    <select id={fieldName} value={currentValue} onChange={(e) => setValue(e.target.value)} disabled={isUploading || !workflowStagePrimary}>
                        <option value="">-- Select Sub-Stage --</option>
                        {getAvailableWorkflowSubStages().map(opt => {
                             // --- ADD OPTION LOG ---
                             console.log(`[RenderFormField Option] Rendering '${fieldName}' option with value: "${opt}"`);
                             // --- END OPTION LOG ---
                             return (<option key={opt} value={opt}>{opt.replace(/_/g, ' ')}</option>);
                        })}
                    </select>
                    {!workflowStagePrimary && <small>Please select a primary stage first</small>}
                    {helperText && <small>{helperText}</small>}
                </div>
            );
        } else if (fieldName === 'thematicFocusPrimary' || fieldName === 'jurisdictionType' || 
                   ['collection', 'documentFunction', 'version', 'workflowStagePrimary',
                    'fileType', 'language', 'accessLevel', 'license'].includes(fieldName)) {
            console.log(`[RenderFormField Select] Rendering '${fieldName}' with select value prop: "${currentValue}"`);
             // FIX: Wrap the select dropdown JSX in the parent div
             return (
                <div className={baseStyles.formGroup}> 
                    <label htmlFor={fieldName}>{getFieldLabel(fieldName)}:</label>
                    {/* Ensure select receives the correct 'value' prop */}
                    <select id={fieldName} value={currentValue} onChange={(e) => setValue(e.target.value)} disabled={isUploading}>
                        <option value="">-- Select --</option>
                        {Array.isArray(metadataOptions[fieldName]) && (metadataOptions[fieldName] as string[]).map((opt: string) => {
                             // --- ADD OPTION LOG ---
                             console.log(`[RenderFormField Option] Rendering '${fieldName}' option with value: "${opt}"`);
                             // --- END OPTION LOG ---
                             return (<option key={opt} value={opt}>{opt.replace(/_/g, ' ')}</option>);
                        })}
                    </select>
                    {helperText && <small>{helperText}</small>}
                </div>
            );
        } else {
            console.log(`[RenderFormField Input] Rendering '${fieldName}' with value prop: "${currentValue}"`);
             return (
                <div className={baseStyles.formGroup}>
                    <label htmlFor={fieldName}>{getFieldLabel(fieldName)}:</label>
                    {/* Ensure input receives the correct 'value' prop */}
                    <input id={fieldName} type="text" value={currentValue} onChange={(e) => setValue(e.target.value)} disabled={isUploading || isReadOnly} readOnly={isReadOnly} title={isReadOnly ? 'This field cannot be changed' : undefined} style={isReadOnly ? { backgroundColor: '#e9ecef', cursor: 'not-allowed' } : undefined} placeholder={`Enter ${getFieldLabel(fieldName).toLowerCase()}...`} />
                    {helperText && <small>{helperText}</small>}
                </div>
            );
        }
    }; // Correct closing brace for renderFormField

    // Render Confirmation Step Content
    const renderConfirmationStep = () => {
        // Provide fallback for calculateDefaultFilename
        const currentFinalItemName = finalItemName || calculateDefaultFilename(publicationDate, originalFileName || 'unknown_file');
        const summaryData = [
            { label: 'Collection', value: collection },
            { label: 'Jurisdiction', value: `${jurisdictionType} / ${jurisdictionName}` },
            { label: 'Thematic Focus', value: `${thematicFocusPrimary} ${thematicFocusSubthemes ? `(${thematicFocusSubthemes.split(',').map((t: string) => t.trim()).filter((t: string) => t).join(', ')})` : ''}` }, 
            { label: 'Issuing Authority', value: `${issuingAuthorityType} / ${issuingAuthorityName}` },
            { label: 'Document Function', value: documentFunction },
            { label: 'Version', value: version },
            { label: 'Workflow Stage', value: `${workflowStagePrimary} / ${workflowStageSub}` },
            { label: 'Publication Date', value: publicationDate ? publicationDate.toISOString().split('T')[0] : 'N/A' }, 
            { label: 'File Type', value: fileType },
            { label: 'Language', value: language }, 
            { label: 'License', value: license },
            { label: 'Access Level', value: accessLevel },
            { label: 'Tags', value: tags },
            { label: 'Description', value: description, isLong: true },
            { label: 'Target Directory', value: targetPath || '/', isPath: true }, 
            { label: 'Final Filename', value: currentFinalItemName, isPath: true }, 
        ];
         return (
             <div className={styles.confirmationContainer}>
                {summaryData.filter(item => item.value || item.label === 'Target Directory').map(item => ( 
                    <div key={item.label} className={`${styles.summaryItem} ${item.isLong ? styles.longItem : ''}`}>
                        <strong className={styles.summaryLabel}>{item.label}:</strong>
                        <span className={`${styles.summaryValue} ${item.isPath ? styles.pathValue : ''}`}>
                            {item.value}
                        </span>
                    </div>
                ))}
            </div>
        );
    };

    // Render form fields for a category OR the confirmation step
    const renderCategoryFields = (categoryId: string) => {
        const category = categories.find((c: any) => c.id === categoryId);
        if (!category || categoryId !== categories[currentStep].id) return null; 

        if (categoryId === 'confirmation') {
             return (
                <div className={`${styles.formSection} ${styles.active}`} key={categoryId}>
                    <h3 className={styles.sectionTitle}>{category.title}</h3>
                    <p className={styles.sectionDescription}>{category.description}</p>
                    {renderConfirmationStep()} 
                    <div className={styles.stepNavigation}>
                        {currentStep > 0 && ( <button type="button" onClick={handlePrevStep} disabled={isUploading} className={`${baseStyles.cancelButton} ${styles.prevButton}`}>Previous Step</button> )}
                        <button type="button" onClick={handleSaveClick} disabled={isUploading} className={baseStyles.confirmButton}> {isUploading ? 'Saving...' : (editingItemPath ? 'Save Metadata' : 'Confirm & Upload')} </button>
                    </div>
                </div>
            );
        }

        return (
            <div className={`${styles.formSection} ${styles.active}`} key={categoryId}>
                 <h3 className={styles.sectionTitle}>{category.title}</h3>
                {category.description && (<p className={styles.sectionDescription}>{category.description}</p>)}
                {category.fields.map((fieldName: string, index: number) => (
                    <div key={`${categoryId}-${fieldName || index}`} className={styles.formField}>
                        {renderFormField(fieldName)}
                    </div>
                ))}
                 <div className={styles.stepNavigation}>
                    {currentStep > 0 && ( <button type="button" onClick={handlePrevStep} disabled={isUploading} className={`${baseStyles.cancelButton} ${styles.prevButton}`}>Previous Step</button> )}
                    {currentStep < categories.length - 1 && ( <button type="button" onClick={handleNextStep} disabled={isUploading} className={`${baseStyles.confirmButton} ${styles.nextButton}`}>Next Step</button> )}
                </div>
            </div>
        );
    };

    if (!isOpen) return null;

    return (
        <div className={baseStyles.modalOverlay}>
            <div className={baseStyles.modalContent} style={{ width: '900px', maxWidth: '95%', padding: '0' }}>
                 {/* MODIFIED: Modal Header */}
                 <div className={styles.modalHeader} style={{ padding: '15px 25px', borderBottom: '1px solid #e9ecef' }}>
                    {/* ADDED: Container for title and preview */}
                    <div style={{ flexGrow: 1, marginRight: '30px' }}> {/* Allow this container to grow and add margin */}
                        {/* Static Title */}
                        <h3 style={{ margin: '0 0 5px 0', fontSize: '1.4rem' }}>
                            {editingItemPath ? 'Edit Metadata' : 'Upload File & Set Metadata'}
                        </h3>
                        {/* Full Path Preview */}
                        <div className={styles.pathPreviewContainer}>
                            <div className={styles.pathPreviewHeader} title={fullPreviewPath}>
                                {isPathExpanded ? groupedPathPreview : shrunkPathPreview || 'Path preview will appear here...'}
                            </div>
                            <button
                                type="button"
                                onClick={() => setIsPathExpanded(!isPathExpanded)}
                                className={styles.pathToggleIcon}
                                title={isPathExpanded ? "Collapse Path" : "Expand Path"}
                            >
                                {isPathExpanded ? <FaCompressArrowsAlt /> : <FaExpandArrowsAlt />}
                            </button>
                        </div>
                    </div>
                    <button onClick={onClose} className={baseStyles.modalCloseButton} disabled={isUploading} style={{ position: 'absolute', top: '15px', right: '20px' }}>&times;</button>
                </div>

                <div className={styles.modalContainer}>
                     <div className={styles.sidebar}>
                        {documentId && ( <div className={styles.documentIdBadge}><span className={styles.documentIdLabel}>Document ID:</span><span className={styles.documentIdValue}>{documentId}</span></div> )}
                        {categories.map((category, index) => (
                            <div key={category.id} className={`${styles.categorySection} ${index === currentStep ? styles.activeStep : ''}`} onClick={() => { setCurrentStep(index); setActiveCategory(category.id); if (category.fields.length > 0) setActiveField(category.fields[0]); else setActiveField(null); }}>
                                <h4 className={styles.categoryTitle}><span className={styles.stepNumber}>{index + 1}</span><span className={styles.stepTitleText}>{category.title.replace(/^Step \d+: /, '')}</span></h4>
                                {category.fields.length > 0 && category.fields.map((fieldName: string) => (
                                    <button key={fieldName} className={`${styles.categoryButton} ${activeCategory === category.id && activeField === fieldName ? styles.active : ''}`} onClick={(e) => { e.stopPropagation(); setActiveCategory(category.id); setActiveField(fieldName); setCurrentStep(index); }}>
                                        {getFieldIcon(fieldName)}
                                        {fieldsConfig[fieldName]?.label || fieldName}
                                    </button>
                                ))}
                            </div>
                        ))}
                    </div>

                     <div className={styles.formContent}>
                        <form onSubmit={(e) => e.preventDefault()}>
                            {categories.map(category => renderCategoryFields(category.id))}
                            {uploadError && <p className={baseStyles.error}>{uploadError}</p>}
                        </form>
                    </div> {/* End formContent div */}
                </div> {/* End modalContainer div */}
            </div> {/* End modalContent div */}
        </div> /* End modalOverlay div */
    );
};

export default MetadataModal;
