/**
 * Utility to download a file from a URL with a custom filename.
 * Automatically appends the correct extension from the URL if it's missing in the filename.
 */
export const downloadFile = (url: string, fileName: string) => {
    const link = document.createElement('a');
    
    // Ensure fileName has an extension based on URL if missing
    let finalFileName = fileName;
    if (fileName && !fileName.includes('.')) {
        const parts = url.split('.');
        if (parts.length > 1) {
            const extension = parts.pop()?.split(/[?#]/)[0];
            // Only append if it looks like a standard extension (e.g. jpg, pdf, docx)
            if (extension && extension.length >= 2 && extension.length <= 4) {
                finalFileName = `${fileName}.${extension}`;
            }
        }
    }

    link.href = url;
    link.target = "_blank";
    link.download = finalFileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
};
