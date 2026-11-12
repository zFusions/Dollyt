/*! Priorités Windows : UI un peu plus réactive, workers FFmpeg moins agressifs. */
#[cfg(windows)]
mod imp {
    use std::ffi::c_void;
    use std::sync::Once;

    const ABOVE_NORMAL_PRIORITY_CLASS: u32 = 0x0000_8000;
    const THREAD_PRIORITY_BELOW_NORMAL: i32 = -1;

    unsafe extern "system" {
        fn GetCurrentProcess() -> *mut c_void;
        fn GetCurrentThread() -> *mut c_void;
        fn SetPriorityClass(process: *mut c_void, priority: u32) -> i32;
        fn SetThreadPriority(thread: *mut c_void, priority: i32) -> i32;
    }

    static APP_ONCE: Once = Once::new();

    pub fn boost_app_process() {
        APP_ONCE.call_once(|| unsafe {
            let _ = SetPriorityClass(GetCurrentProcess(), ABOVE_NORMAL_PRIORITY_CLASS);
        });
    }

    pub fn deprioritize_worker_thread() {
        unsafe {
            let _ = SetThreadPriority(GetCurrentThread(), THREAD_PRIORITY_BELOW_NORMAL);
        }
    }
}

#[cfg(not(windows))]
mod imp {
    pub fn boost_app_process() {}
    pub fn deprioritize_worker_thread() {}
}

pub use imp::{boost_app_process, deprioritize_worker_thread};
