import os
import zipfile

def zip_dist():
    print("Zipping dist directory...")
    with zipfile.ZipFile('dist.zip', 'w', zipfile.ZIP_DEFLATED) as zipf:
        for root, dirs, files in os.walk('dist'):
            for file in files:
                file_path = os.path.join(root, file)
                # Make the path relative to the 'dist' directory
                arcname = os.path.relpath(file_path, 'dist')
                # Replace backslashes with forward slashes to ensure cross-platform compatibility
                # AWS Amplify expects forward slashes (/) for nested directories like assets/
                arcname = arcname.replace(os.sep, '/')
                zipf.write(file_path, arcname)
    print("Zipping complete.")

if __name__ == "__main__":
    zip_dist()
    print("Zip file 'dist.zip' created successfully with forward-slash paths.")
    print("To deploy to Amplify:")
    print("1. Request a deployment URL from Amplify")
    print("2. PUT this dist.zip to the upload URL")
    print("3. Start the deployment")
