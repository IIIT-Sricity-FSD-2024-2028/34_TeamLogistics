(function () {
  const { readState, saveState } = window.DeliverySyncData;
  const { $, $all, setError, clearErrors, validateEmail, validatePhone, validatePassword, generateId, setupPasswordToggles, showToast } = window.DeliverySyncUtils;

  const formConfigs = {
    'business-form': {
      role: 'business-client',
      userPrefix: 'BC',
      validate(values, form) {
        let ok = true;
        if (!values.companyName.trim() || values.companyName.trim().length < 2) { setError($('#companyName', form), 'Enter a valid company name (at least 2 characters)'); ok = false; }
        else if (/^\d+$/.test(values.companyName.trim())) { setError($('#companyName', form), 'Company name cannot be only numbers'); ok = false; }
        if (!/^[A-Za-z ]{3,40}$/.test(values.fullName.trim())) { setError($('#fullName', form), 'Enter a valid full name'); ok = false; }
        if (values.companyContact.trim() && !/^[6-9]\d{9}$/.test(values.companyContact.trim())) { setError($('#companyContact', form), 'Phone number must start with 6, 7, 8, or 9'); ok = false; }
        if (values.businessAddress.trim().length < 8) { setError($('#businessAddress', form), 'Business address is too short'); ok = false; }
        if (!/^[6-9]\d{9}$/.test(values.personalMobile.trim())) { setError($('#personalMobile', form), 'Phone number must start with 6, 7, 8, or 9'); ok = false; }
        const businessEmailRegex = /^(?=.{1,64}@)(?=.{6,320}$)(?!\.)(?!.*\.\.)([A-Za-z0-9!#$%&'*+\-/=?^_`{|}~]+(?:\.[A-Za-z0-9!#$%&'*+\-/=?^_`{|}~]+)*)@([A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?(?:\.[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?)+)$/;
        if (!businessEmailRegex.test(values.email.trim())) { setError($('#email', form), "Enter a valid email in personal_info@domain format. Use letters, numbers, allowed special characters (! # $ % & ' * + - / = ? ^ _ ` { | } ~), dots not at the start/end or repeated, max 64 chars before @, and a valid domain after @."); ok = false; }
        if (!/^(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z\d]).{8,}$/.test(values.password)) { setError($('#password', form), 'Minimum 8 chars with 1 capital, 1 number, 1 special char'); ok = false; }
        if (values.confirmPassword !== values.password) { setError($('#confirmPassword', form), 'Passwords do not match'); ok = false; }
        if (!$('#terms', form).checked) { setError($('#terms', form), 'You must accept the terms'); ok = false; }
        return ok;
      },
      transform(values, state) {
        const userId = generateId('BC', state.users);
        const companyName = values.companyName.trim() || values.fullName.trim();
        const companyContact = values.companyContact.trim() || values.personalMobile.trim();
        return {
          user: { id: userId, name: companyName, email: values.email, password: values.password, role: 'business-client', status: 'Active', phone: values.personalMobile, profileDetails: { companyName, fullName: values.fullName.trim(), businessAddress: values.businessAddress.trim(), companyContactNumber: companyContact } },
          collection: 'clients',
          record: { id: generateId('CL', state.clients), company: companyName, contact: companyContact, address: values.businessAddress, requests: 0, status: 'Active' }
        };
      }
    },
    'fleet-form': {
      role: 'fleet-manager',
      userPrefix: 'FM',
      validate(values, form) {
        let ok = true;
        if (values.companyName.trim().length < 2) { setError($('#companyName', form), 'Enter company name'); ok = false; }
        if (values.managerName.trim().length < 2) { setError($('#managerName', form), 'Enter fleet manager name'); ok = false; }
        if (values.companyAddress.trim().length < 8) { setError($('#companyAddress', form), 'Company address is required'); ok = false; }
        if (!/^\d+$/.test(values.vehicleCount) || Number(values.vehicleCount) <= 0) { setError($('#vehicleCount', form), 'Enter a valid vehicle count'); ok = false; }
        if (!validatePhone(values.phone)) { setError($('#phone', form), 'Enter valid phone number'); ok = false; }
        if (!validateEmail(values.email)) { setError($('#email', form), 'Enter valid email'); ok = false; }
        if (!validatePassword(values.password)) { setError($('#password', form), 'Minimum 8 chars with upper, lower, number, special char'); ok = false; }
        if (values.confirmPassword !== values.password) { setError($('#confirmPassword', form), 'Passwords do not match'); ok = false; }
        return ok;
      },
      transform(values, state) {
        return {
          user: { id: generateId('FM', state.users), name: values.managerName, email: values.email, password: values.password, role: 'fleet-manager', status: 'Active' },
          collection: 'fleets',
          record: { id: generateId('FL', state.fleets), company: values.companyName, manager: values.managerName, vehicles: Number(values.vehicleCount), zone: 'New Zone', status: 'Pending' }
        };
      }
    },
    'driver-form': {
      role: 'driver',
      userPrefix: 'DR',
      validate(values, form) {
        let ok = true;
        const fullName = String(values.name || '').trim();
        const phone = String(values.phone || '').trim();
        const license = String(values.license || '').trim().toUpperCase();
        const email = String(values.email || '').trim();
        const password = String(values.password || '');
        const licenseFile = $('#licenseDoc', form) && $('#licenseDoc', form).files ? $('#licenseDoc', form).files[0] : null;
        const bankBookFile = $('#bankBook', form) && $('#bankBook', form).files ? $('#bankBook', form).files[0] : null;
        const emailRegex = /^(?=.{1,64}@)(?=.{6,320}$)(?!\.)(?!.*\.\.)([A-Za-z0-9!#$%&'*+\-/=?^_`{|}~]+(?:\.[A-Za-z0-9!#$%&'*+\-/=?^_`{|}~]+)*)@([A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?(?:\.[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?)+)$/;

        if (!/^[A-Za-z ]+$/.test(fullName) || fullName.length < 2) { setError($('#name', form), 'Full name should contain only letters and spaces'); ok = false; }
        if (!/^[6-9]\d{9}$/.test(phone)) { setError($('#phone', form), 'Phone number should be 10 digits and start with 9, 8, 7, or 6'); ok = false; }
        if (!/^[A-Z]{2}-\d{2}-\d{4}-\d{7}$/.test(license)) { setError($('#license', form), 'Driver License Number should be in AA-12-1234-1234567 format'); ok = false; }
        if (!licenseFile) { setError($('#licenseDoc', form), 'Upload License is required'); ok = false; }
        else if (!/\.png$/i.test(licenseFile.name) && licenseFile.type !== 'image/png') { setError($('#licenseDoc', form), 'Only PNG file is allowed for Upload License'); ok = false; }
        if (!/^[A-Za-z ]+$/.test(values.accountHolder.trim()) || values.accountHolder.trim().length < 2) { setError($('#accountHolder', form), 'Account Holder Name should contain only letters and spaces'); ok = false; }
        if (!/^\d{12}$/.test(values.accountNumber.trim())) { setError($('#accountNumber', form), 'Account Number should be exactly 12 digits'); ok = false; }
        if (!/^[A-Z]{4}0[A-Z0-9]{6}$/.test(values.ifsc.trim().toUpperCase())) { setError($('#ifsc', form), 'IFSC Code must be 11 characters: first 4 letters, 5th 0, last 6 letters or numbers'); ok = false; }
        if (!/^[A-Za-z .&-]+$/.test(values.bankName.trim()) || values.bankName.trim().length < 2) { setError($('#bankName', form), 'Bank Name should contain only letters, spaces, dots, ampersand, and hyphen'); ok = false; }
        if (!bankBookFile) { setError($('#bankBook', form), 'Upload Bank Book is required'); ok = false; }
        else if (!/\.png$/i.test(bankBookFile.name) && bankBookFile.type !== 'image/png') { setError($('#bankBook', form), 'Only PNG file is allowed for Upload Bank Book'); ok = false; }
        if (!emailRegex.test(email)) { setError($('#email', form), 'Enter a valid email address'); ok = false; }
        if (!/^(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,}$/.test(password)) { setError($('#password', form), 'Password must be minimum 8 characters with 1 capital letter, 1 number, and 1 special character'); ok = false; }
        if (values.confirmPassword !== values.password) { setError($('#confirmPassword', form), 'Passwords do not match'); ok = false; }
        return ok;
      },
      transform(values, state, form) {
        const licenseFile = $('#licenseDoc', form) && $('#licenseDoc', form).files ? $('#licenseDoc', form).files[0] : null;
        const bankBookFile = $('#bankBook', form) && $('#bankBook', form).files ? $('#bankBook', form).files[0] : null;
        return {
          user: { id: generateId('DR', state.users), name: values.name.trim(), email: values.email.trim(), password: values.password, role: 'driver', status: 'Pending Approval', phone: values.phone.trim(), profileDetails: { licenseNumber: values.license.trim().toUpperCase(), accountHolderName: values.accountHolder.trim(), accountNumber: values.accountNumber.trim(), ifscCode: values.ifsc.trim().toUpperCase(), bankName: values.bankName.trim(), licenseDocument: licenseFile ? licenseFile.name : '', bankBook: bankBookFile ? bankBookFile.name : '' } },
          collection: 'drivers',
          record: { id: generateId('DR', state.drivers), userEmail: values.email.trim(), name: values.name.trim(), phone: values.phone.trim(), zone: 'New Zone', vehicle: 'Not Assigned', status: 'Pending Approval' },
          extra: [
            {
              collection: 'documents',
              record: { id: generateId('DOC', state.documents), type: 'Driving License', owner: values.name.trim(), review: 'Pending', updated: new Date().toISOString().slice(0, 10) }
            },
            {
              collection: 'documents',
              record: { id: generateId('DOC', state.documents.concat([{id:'TMP'}])), type: 'Bank Book', owner: values.name.trim(), review: 'Pending', updated: new Date().toISOString().slice(0, 10) }
            }
          ]
        };
      }
    }
  };

  function attachForm(formId) {
    const form = document.getElementById(formId);
    const config = formConfigs[formId];
    if (!form || !config) return;
    setupPasswordToggles(form);

    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      clearErrors(form);
      const formData = new FormData(form);
      const values = Object.fromEntries(formData.entries());
      const state = readState();

      if (!config.validate(values, form)) return;
      const payload = config.transform(values, state, form);

      const submitBtn = form.querySelector('button[type="submit"]');
      const originalBtnText = submitBtn ? submitBtn.textContent : '';

      try {
        if (submitBtn) {
          submitBtn.disabled = true;
          submitBtn.textContent = 'Submitting...';
        }

        const apiPayload = {
          name: payload.user.name,
          email: payload.user.email,
          password: payload.user.password,
          role: payload.user.role,
          phone: payload.user.phone || '',
          profileDetails: payload.user.profileDetails || {}
        };

        await window.DeliverySyncAPI.Auth.register(apiPayload);

        showToast(config.role === 'driver' ? 'Driver registration submitted for super user approval.' : 'Account created successfully. Awaiting super user approval.');
        form.reset();
        [['licenseDocName','No file chosen'],['bankBookName','No file chosen']].forEach(([id,label])=>{ const el=document.getElementById(id); if(el) el.textContent=label; });
        setTimeout(() => { window.location.href = 'login.html'; }, 700);
      } catch (apiErr) {
        console.error('Registration failed:', apiErr);
        setError($('#email', form), apiErr.message || 'Registration failed. Please try again.');
      } finally {
        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.textContent = originalBtnText;
        }
      }
    });
  }

  document.addEventListener('DOMContentLoaded', () => {
    ['business-form', 'fleet-form', 'driver-form'].forEach(attachForm);
  });
})();
