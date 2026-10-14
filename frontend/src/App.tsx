import { useTranslation } from "./i18n";
import { useLoginUser } from "./auth";
import { emptyDetailFilters, filterDetails } from "./detailFilters";
import { useState, useEffect, useMemo, useRef } from "react";
import "./App.css";
import "./playful-theme.css";
import { CurrencyContext } from "./currency";
import type {
  Reimbursement,
  ReimbursementWithDepartment,
  Department,
  ReceiptImage,
} from "./types";
import {
  reimbursementApi,
  summaryApi,
  departmentApi,
  imageApi,
} from "./api";
import HeaderSummary from "./components/HeaderSummary";
import FilterPanel from "./components/FilterPanel";
import DepartmentManager from "./components/DepartmentManager";
import ReimbursementForm from "./components/ReimbursementForm";
import ReimbursementTable from "./components/ReimbursementTable";
import ApprovalBatches from "./components/ApprovalBatches";

function App() {
  const t = useTranslation();
  const [page, setPage] = useState(() => window.location.hash === "#/approvals" ? "approvals" : "reimbursements");
  useEffect(() => {
    document.body.classList.toggle("fixed-detail-layout", page === "reimbursements");
    return () => document.body.classList.remove("fixed-detail-layout");
  }, [page]);
  useEffect(() => {
    const onHashChange = () => setPage(window.location.hash === "#/approvals" ? "approvals" : "reimbursements");
    window.addEventListener("hashchange", onHashChange);
    return () => window.removeEventListener("hashchange", onHashChange);
  }, []);
  const user = useLoginUser();
  const currency = user?.currency || "CNY";
  interface FormErrors {
    desc?: string;
    amount?: string;
    date?: string;
    departmentId?: string;
    submit?: string;
  }

  const [reimbursements, setReimbursements] = useState<
    ReimbursementWithDepartment[]
  >([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [advancedFilters, setAdvancedFilters] = useState(emptyDetailFilters);
  const [searchKeyword, setSearchKeyword] = useState("");
  const [debouncedSearchKeyword, setDebouncedSearchKeyword] = useState("");
  const [selectedDepartmentId, setSelectedDepartmentId] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Summary stats
  const [totalCount, setTotalCount] = useState(0);
  const [totalAmount, setTotalAmount] = useState(0);
  const [pendingCount, setPendingCount] = useState(0);

  // Form state
  const [desc, setDesc] = useState("");
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState("交通");
  const [date, setDate] = useState(() => {
    // Initialize date to today
    return new Date().toISOString().slice(0, 10);
  });
  const [status, setStatus] = useState("待审批");
  const [departmentId, setDepartmentId] = useState("");

  // Department management state
  const [showDepartmentManager, setShowDepartmentManager] = useState(false);
  const [editingDepartmentId, setEditingDepartmentId] = useState<string | null>(
    null,
  );
  const [departmentName, setDepartmentName] = useState("");
  const [departmentDescription, setDepartmentDescription] = useState("");

  // Image upload state
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [images, setImages] = useState<Record<string, ReceiptImage[]>>({});
  const [uploadingImage, setUploadingImage] = useState(false);
  const [currentReceiptFilename, setCurrentReceiptFilename] = useState<
    string | null
  >(null);
  const [formErrors, setFormErrors] = useState<FormErrors>({});
  const formPanelRef = useRef<HTMLDivElement | null>(null);

  // Debounce search input
  useEffect(() => {
    const timerId = setTimeout(() => {
      setDebouncedSearchKeyword(searchKeyword);
    }, 300); // 300ms delay

    return () => {
      clearTimeout(timerId);
    };
  }, [searchKeyword]);

  useEffect(() => {
    const isValidNow =
      !!desc.trim() &&
      !!date &&
      !!departmentId &&
      !isNaN(parseFloat(amount)) &&
      parseFloat(amount) > 0;

    setFormErrors((prev) => {
      const next = { ...prev };
      if (desc.trim()) {
        delete next.desc;
      }
      if (!isNaN(parseFloat(amount)) && parseFloat(amount) > 0) {
        delete next.amount;
      }
      if (date) {
        delete next.date;
      }
      if (departmentId) {
        delete next.departmentId;
      }
      if (isValidNow) {
        delete next.submit;
      }
      return next;
    });
  }, [amount, date, departmentId, desc]);

  // Load departments on initial mount
  useEffect(() => {
    async function loadDepartments() {
      try {
        const deptData = await departmentApi.getAll();
        setDepartments(deptData);
        // Set default department if none selected and departments exist
        if (!departmentId && deptData.length > 0) {
          setDepartmentId(deptData[0].id);
        }
      } catch (err) {
        console.error("Error loading departments:", err);
      }
    }
    loadDepartments();
  }, []);

  // Load data on component mount and when debounced search/department filter changes
  useEffect(() => {
    const isInitialMount =
      departments.length === 0 && reimbursements.length === 0;
    loadData(isInitialMount);
  }, [debouncedSearchKeyword, selectedDepartmentId]);

  async function loadData(isInitialLoad = false) {
    try {
      if (isInitialLoad) {
        setLoading(true);
      }
      setError(null);

      // Only load departments on initial load or when departments are empty
      if (isInitialLoad || departments.length === 0) {
        const deptData = await departmentApi.getAll();
        setDepartments(deptData);
        // Set default department if none selected and departments exist
        if (!departmentId && deptData.length > 0) {
          setDepartmentId(deptData[0].id);
        }
      }

      // Load reimbursements with filters
      const data = await reimbursementApi.getAll(
        debouncedSearchKeyword || undefined,
        selectedDepartmentId || undefined,
      );
      setReimbursements(data);

      // Load summary with department filter
      const summary = await summaryApi.getSummary(
        selectedDepartmentId || undefined,
      );
      setTotalCount(summary.totalCount);
      setTotalAmount(summary.totalAmount);
      setPendingCount(summary.pendingCount);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load data");
      console.error("Error loading data:", err);
    } finally {
      if (isInitialLoad) {
        setLoading(false);
      }
    }
  }

  // Handle reimbursement form submission
  const validateForm = (): FormErrors => {
    const nextErrors: FormErrors = {};
    const amountNum = parseFloat(amount);

    if (!desc.trim()) {
      nextErrors.desc = "请填写报销事由";
    }
    if (isNaN(amountNum) || amountNum <= 0) {
      nextErrors.amount = "金额必须是大于 0 的数字";
    }
    if (!date) {
      nextErrors.date = "请选择日期";
    }
    if (!departmentId) {
      nextErrors.departmentId = "请选择部门";
    }

    return nextErrors;
  };

  const canSubmit = useMemo(() => {
    return (
      !!desc.trim() &&
      !!date &&
      !!departmentId &&
      !isNaN(parseFloat(amount)) &&
      parseFloat(amount) > 0
    );
  }, [amount, date, departmentId, desc]);

  const handleSubmit = async () => {
    if (uploadingImage) return;
    const nextErrors = validateForm();
    if (Object.keys(nextErrors).length > 0) {
      setFormErrors(nextErrors);
      return;
    }

    setUploadingImage(true);
    try {
      setFormErrors({});
      const amountNum = parseFloat(amount);
      const receiptFilename = currentReceiptFilename;
      let reimbursementId = editingId;
      if (editingId) {
        // Update existing record
        await reimbursementApi.update(editingId, {
          desc,
          amount: amountNum,
          category,
          date,
          status: status as Reimbursement["status"],
          department_id: departmentId,
          receipt_filename: receiptFilename,
        });
        reimbursementId = editingId;
      } else {
        // Add new record
        const created = await reimbursementApi.create({
          desc,
          amount: amountNum,
          category,
          date,
          status: status as Reimbursement["status"],
          department_id: departmentId,
          receipt_filename: receiptFilename,
        });
        reimbursementId = created.id;
      }

      if (reimbursementId) {
        setEditingId(reimbursementId);
        for (let index = 0; index < selectedFiles.length; index++) {
          try {
            const image = await imageApi.upload(reimbursementId, selectedFiles[index]);
            setCurrentReceiptFilename(previous => previous || image.filepath.split(/[\\/]/).pop() || null);
            setImages(prev => ({ ...prev, [reimbursementId]: [...(prev[reimbursementId] || []), image] }));
            setSelectedFiles(selectedFiles.slice(index + 1));
          } catch (err) {
            setFormErrors({ submit: "报销记录已保存，部分图片上传失败，请重试剩余图片：" + (err instanceof Error ? err.message : "未知错误") });
            await loadData();
            return;
          }
        }
        const saved = await reimbursementApi.getById(reimbursementId);
        setCurrentReceiptFilename(saved.receipt_filename ?? null);
      }

      // Refresh data
      await loadData();
      // Reset form
      handleResetForm();
    } catch (err) {
      setFormErrors({
        submit: err instanceof Error ? err.message : "操作失败",
      });
      console.error("Error saving reimbursement:", err);
    } finally {
      setUploadingImage(false);
    }
  };

  // Handle edit reimbursement
  const handleEdit = async (id: string) => {
    const item = reimbursements.find((r) => r.id === id);
    if (!item || uploadingImage || item.status === "已报销" || item.status === "已报废") return;
    setSelectedFiles([]);

    setDesc(item.desc);
    setAmount(item.amount.toString());
    setCategory(item.category);
    setDate(item.date);
    setStatus(item.status);
    setDepartmentId(item.department_id);
    setEditingId(id);
    setCurrentReceiptFilename(item.receipt_filename ?? null);
    setFormErrors({});

    if (window.innerWidth < 768) {
      requestAnimationFrame(() => {
        formPanelRef.current?.scrollIntoView({
          behavior: "smooth",
          block: "start",
        });
      });
    }

    // Load images for this reimbursement
    try {
      const reimbursementImages = await imageApi.getByReimbursement(id);
      setImages((prev) => ({
        ...prev,
        [id]: reimbursementImages,
      }));
    } catch (err) {
      console.error("Error loading images:", err);
    }
  };

  // Handle delete reimbursement
  const handleDelete = async (id: string) => {
    const item = reimbursements.find(row => row.id === id);
    if (!item || uploadingImage || item.status === "已报销" || item.status === "已报废") return;
    const reason = window.prompt("请填写报废原因（必填，报废后保留记录且不能再编辑）：");
    if (reason === null) return;
    if (!reason.trim() || reason.trim().length > 1000) { alert("请填写 1–1000 字的报废原因"); return; }

    try {
      await reimbursementApi.void(id, reason.trim());
      // Refresh data
      await loadData();
      // If editing the deleted item, reset form
      if (editingId === id) {
        handleResetForm();
      }
    } catch (err) {
      alert(err instanceof Error ? err.message : "报废失败");
      console.error("Error deleting reimbursement:", err);
    }
  };

  // Handle delete image
  const handleDeleteImage = async (imageId: string) => {
    if (!window.confirm("确定要删除这张图片吗？")) {
      return;
    }

    try {
      await imageApi.delete(imageId);
      if (editingId) {
        const saved = await reimbursementApi.getById(editingId);
        setCurrentReceiptFilename(saved.receipt_filename ?? null);
        await loadData();
      }

      // Update local state
      if (editingId) {
        setImages((prev) => {
          const currentImages = prev[editingId] || [];
          return {
            ...prev,
            [editingId]: currentImages.filter((img) => img.id !== imageId),
          };
        });
      }

      console.log("Image deleted successfully");
    } catch (err) {
      alert(err instanceof Error ? err.message : "删除图片失败");
      console.error("Error deleting image:", err);
    }
  };

  // Reset reimbursement form
  const handleResetForm = () => {
    setDesc("");
    setAmount("");
    setCategory("交通");
    setDate(new Date().toISOString().slice(0, 10));
    setStatus("待审批");
    setDepartmentId(departments.length > 0 ? departments[0].id : "");
    setEditingId(null);
    setSelectedFiles([]);
    setCurrentReceiptFilename(null);
    setFormErrors({});
  };

  // Clear search
  const handleClearSearch = () => {
    setAdvancedFilters({ ...emptyDetailFilters });
    setSearchKeyword("");
    setDebouncedSearchKeyword("");
    setSelectedDepartmentId("");
  };

  // Department management functions
  const handleAddDepartment = async () => {
    if (!departmentName.trim()) {
      alert("请输入部门名称");
      return;
    }

    try {
      if (editingDepartmentId) {
        await departmentApi.update(editingDepartmentId, {
          name: departmentName,
          description: departmentDescription,
        });
        setEditingDepartmentId(null);
      } else {
        await departmentApi.create({
          name: departmentName,
          description: departmentDescription,
        });
      }

      // Refresh data
      await loadData();
      // Reset department form
      setDepartmentName("");
      setDepartmentDescription("");
      setShowDepartmentManager(false);
    } catch (err) {
      alert(err instanceof Error ? err.message : "操作失败");
      console.error("Error saving department:", err);
    }
  };

  const handleEditDepartment = (dept: Department) => {
    setDepartmentName(dept.name);
    setDepartmentDescription(dept.description || "");
    setEditingDepartmentId(dept.id);
    setShowDepartmentManager(true);
  };

  const handleDeleteDepartment = async (id: string) => {
    if (
      !window.confirm(
        "确定要删除这个部门吗？该部门下的所有报销记录也将被删除。",
      )
    ) {
      return;
    }

    try {
      await departmentApi.delete(id);
      await loadData();
      if (selectedDepartmentId === id) {
        setSelectedDepartmentId("");
      }
      if (departmentId === id) {
        setDepartmentId(
          departments.length > 1
            ? departments.find((d) => d.id !== id)?.id || ""
            : "",
        );
      }
    } catch (err) {
      alert(err instanceof Error ? err.message : "删除失败");
      console.error("Error deleting department:", err);
    }
  };

  const resetDepartmentForm = () => {
    setDepartmentName("");
    setDepartmentDescription("");
    setEditingDepartmentId(null);
  };

  if (loading && reimbursements.length === 0) {
    return (
      <div className="container">
        <div style={{ textAlign: "center", padding: "3rem" }}>
          <p>{t("加载中...")}</p>
        </div>
      </div>
    );
  }

  return (
    <CurrencyContext.Provider value={currency}>
    <div className="container">
      <div className="workspace-toolbar">
      <nav className="page-navigation" aria-label={t("页面导航")}>
        <a href="#/reimbursements" aria-current={page === "reimbursements" ? "page" : undefined}>{t("报销明细")}</a>
        <a href="#/approvals" aria-current={page === "approvals" ? "page" : undefined}>{t("审批组与历史档案")}</a>
      </nav>
      </div>
      {page === "reimbursements" && <>
      <HeaderSummary
        totalCount={totalCount}
        totalAmount={totalAmount}
        pendingCount={pendingCount}
        departmentCount={departments.length}
      />

      {error && (
        <div
          style={{
            background: "#fee",
            color: "#c00",
            padding: "1rem",
            borderRadius: "8px",
            marginBottom: "1rem",
          }}
        >
          <strong>{t("错误:")}</strong> {t(error)}
          <button
            onClick={() => loadData(false)}
            style={{
              marginLeft: "1rem",
              background: "#c00",
              color: "white",
              border: "none",
              padding: "0.25rem 0.5rem",
              borderRadius: "4px",
            }}
          >
            {t("重试")}</button>
        </div>
      )}

      <div className="workspace">
        <aside className="workspace-form" ref={formPanelRef}>
          <ReimbursementForm
            editingId={editingId}
            desc={desc}
            setDesc={setDesc}
            amount={amount}
            setAmount={setAmount}
            category={category}
            setCategory={setCategory}
            date={date}
            setDate={setDate}
            status={status}
            setStatus={setStatus}
            departmentId={departmentId}
            setDepartmentId={setDepartmentId}
            departments={departments}
            selectedFiles={selectedFiles}
            setSelectedFiles={setSelectedFiles}
            images={images}
            uploadingImage={uploadingImage}
            handleSubmit={handleSubmit}
            handleResetForm={handleResetForm}
            handleDeleteImage={handleDeleteImage}
            currentReceiptFilename={currentReceiptFilename}
            formErrors={formErrors}
            canSubmit={canSubmit}
          />
        </aside>

        <section className="workspace-content">


          <DepartmentManager
            showDepartmentManager={showDepartmentManager}
            editingDepartmentId={editingDepartmentId}
            departmentName={departmentName}
            setDepartmentName={setDepartmentName}
            departmentDescription={departmentDescription}
            setDepartmentDescription={setDepartmentDescription}
            departments={departments}
            handleAddDepartment={handleAddDepartment}
            handleEditDepartment={handleEditDepartment}
            handleDeleteDepartment={handleDeleteDepartment}
            resetDepartmentForm={resetDepartmentForm}
            setShowDepartmentManager={setShowDepartmentManager}
          />

          <ReimbursementTable
            filters={
          <FilterPanel
            advanced={advancedFilters}
            onApply={(keyword, department, advanced) => {
              setSearchKeyword(keyword);
              setDebouncedSearchKeyword(keyword);
              setSelectedDepartmentId(department);
              setAdvancedFilters(advanced);
            }}
            searchKeyword={searchKeyword}
            selectedDepartmentId={selectedDepartmentId}
            departments={departments}
            showDepartmentManager={showDepartmentManager}
            setShowDepartmentManager={setShowDepartmentManager}
            handleClearSearch={handleClearSearch}
          />
            }
            searchKeyword={JSON.stringify([debouncedSearchKeyword, advancedFilters])}
            savingForm={uploadingImage}
            onBatchChanged={async () => {
              if (editingId) handleResetForm();
              await loadData();
            }}
            reimbursements={filterDetails(reimbursements, advancedFilters)}
            departments={departments}
            selectedDepartmentId={selectedDepartmentId}
            totalCount={totalCount}
            handleEdit={handleEdit}
            handleDelete={handleDelete}
            editingId={editingId}
            hasActiveFilter={!!searchKeyword || !!selectedDepartmentId || Object.values(advancedFilters).some(Boolean)}
          />
        </section>
      </div>
      </>}
      {page === "approvals" && <div className="archive-page"><ApprovalBatches disabled={uploadingImage} onChanged={async () => {
        if (editingId) handleResetForm();
        await loadData();
      }} /></div>}
      <footer>{t("⚡ 按部门管理报销 — 数据隔离不串台 — 所有变动实时更新")}</footer>
    </div>
    </CurrencyContext.Provider>
  );
}

export default App;
